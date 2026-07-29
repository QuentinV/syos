import { Game, Player } from '../../state/types';

export type MessageHandler = (message: {
    type: string;
    data?: any;
    clock?: number;
    peerId?: string;
}) => void;

/**
 * In-memory mock of a PeerJS peer for testing P2P sync without WebRTC.
 * Each MockPeer has its own DSStore-like state and can connect to other peers.
 *
 * Now supports Lamport clock-based ordering: messages are stamped with
 * a monotonic clock and reordered on receive based on (clock, peerId).
 */
export class MockPeer {
    public peerId: string;
    public state: Game | null = null;
    public connectedPeers: Map<string, MockPeer> = new Map();
    public messageLog: { from: string; message: any }[] = [];
    public isDisconnected = false;
    public dropNextMessage = false;
    public onMessage: MessageHandler | null = null;
    public onConnection: ((peer: MockPeer) => void) | null = null;

    // Lamport clock
    public lamportClock = 0;
    private eventBuffer: {
        from: string;
        message: { type: string; data?: any; clock: number; peerId: string };
    }[] = [];
    private flushTimeoutId: ReturnType<typeof setTimeout> | null = null;

    constructor(peerId: string, initialState: Game | null = null) {
        this.peerId = peerId;
        this.state = initialState;
    }

    connect(other: MockPeer): void {
        if (this.isDisconnected) return;
        this.connectedPeers.set(other.peerId, other);
        other.connectedPeers.set(this.peerId, this);
        this.onConnection?.(other);
        other.onConnection?.(this);
    }

    disconnect(): void {
        this.isDisconnected = true;
        this.connectedPeers.forEach((_, peerId) => {
            const peer = this.connectedPeers.get(peerId);
            if (peer) {
                peer.connectedPeers.delete(this.peerId);
            }
        });
        this.connectedPeers.clear();
        if (this.flushTimeoutId) {
            clearTimeout(this.flushTimeoutId);
            this.flushTimeoutId = null;
        }
    }

    reconnect(existingPeer: MockPeer): void {
        this.isDisconnected = false;
        this.connect(existingPeer);
    }

    /**
     * Broadcast a message to all connected peers with a Lamport clock stamp.
     * Also applies the event locally (simulating the real DSStore behavior
     * where the reducer runs locally first, then broadcasts to peers).
     */
    broadcast(message: { type: string; data?: any }): void {
        if (this.isDisconnected) return;

        // Stamp with Lamport clock
        this.lamportClock++;
        const stamped = {
            ...message,
            clock: this.lamportClock,
            peerId: this.peerId,
        };

        // Apply locally first (simulates the local reducer execution)
        this.messageLog.push({ from: this.peerId, message: stamped });
        this.onMessage?.(stamped);

        // Then send to connected peers
        this.connectedPeers.forEach((peer) => {
            if (peer.isDisconnected) return;

            if (this.dropNextMessage) {
                this.dropNextMessage = false;
                return;
            }

            peer.receiveMessage(this.peerId, stamped);
        });
    }

    /**
     * Receive a message, buffer it, and attempt to apply in clock order.
     */
    receiveMessage(
        from: string,
        message: {
            type: string;
            data?: any;
            clock?: number;
            peerId?: string;
        }
    ): void {
        if (this.isDisconnected) return;

        // Update our Lamport clock: take the max of our clock and the received clock, then increment
        if (message.clock !== undefined) {
            this.lamportClock = Math.max(this.lamportClock, message.clock) + 1;
        }

        // Add to buffer with a default clock of 0 if not provided
        this.eventBuffer.push({
            from,
            message: {
                ...message,
                clock: message.clock ?? 0,
                peerId: message.peerId ?? from,
            },
        });

        this.tryFlushBuffer();
    }

    /**
     * Try to apply buffered events in order.
     * Events are ordered by (clock, peerId) to ensure deterministic ordering.
     * An event is ready to apply if its clock is exactly lastAppliedClock + 1,
     * or if we've waited long enough (gap handling via timeout).
     */
    private tryFlushBuffer(): void {
        // Sort by (clock, peerId) for deterministic ordering
        this.eventBuffer.sort((a, b) => {
            if (a.message.clock !== b.message.clock) {
                return a.message.clock - b.message.clock;
            }
            return a.message.peerId.localeCompare(b.message.peerId);
        });

        // Find the contiguous sequence starting from clock 1
        let lastAppliedClock = 0;
        const toApply: typeof this.eventBuffer = [];
        const remaining: typeof this.eventBuffer = [];

        for (const entry of this.eventBuffer) {
            if (entry.message.clock === lastAppliedClock + 1) {
                toApply.push(entry);
                lastAppliedClock = entry.message.clock;
            } else {
                remaining.push(entry);
            }
        }

        this.eventBuffer = remaining;

        // Apply in order
        for (const { from, message } of toApply) {
            this.messageLog.push({ from, message });
            this.onMessage?.(message);
        }

        // If there's a gap, schedule a flush attempt after a short delay
        if (this.eventBuffer.length > 0 && !this.flushTimeoutId) {
            this.flushTimeoutId = setTimeout(() => {
                this.flushTimeoutId = null;
                // Force apply all buffered events in sorted order
                this.eventBuffer.sort((a, b) => {
                    if (a.message.clock !== b.message.clock) {
                        return a.message.clock - b.message.clock;
                    }
                    return a.message.peerId.localeCompare(b.message.peerId);
                });
                for (const { from, message } of this.eventBuffer) {
                    this.messageLog.push({ from, message });
                    this.onMessage?.(message);
                }
                this.eventBuffer = [];
            }, 100);
        }
    }

    /**
     * Corrupt the local state to simulate divergence.
     */
    corruptState(overrides: Partial<Game>): void {
        if (this.state) {
            this.state = { ...this.state, ...overrides };
        }
    }

    getState(): Game | null {
        return this.state;
    }

    setState(state: Game | null): void {
        this.state = state;
    }

    /**
     * Check if this peer's state matches another peer's state.
     */
    isStateEqual(other: MockPeer): boolean {
        return JSON.stringify(this.state) === JSON.stringify(other.state);
    }
}

/**
 * Create a set of connected MockPeers for testing.
 */
export function createPeers(
    count: number,
    initialState?: Game | null
): MockPeer[] {
    const peers: MockPeer[] = [];
    for (let i = 0; i < count; i++) {
        peers.push(new MockPeer(`peer-${i}`, initialState ?? null));
    }
    // Connect all peers to each other
    for (let i = 0; i < count; i++) {
        for (let j = i + 1; j < count; j++) {
            peers[i].connect(peers[j]);
        }
    }
    return peers;
}

/**
 * Create a minimal mock game state for testing.
 */
export function createMockGame(overrides: Partial<Game> = {}): Game {
    return {
        id: 'test-game-id',
        players: {},
        turns: [],
        createdAt: Date.now(),
        status: 'lobby',
        peerId: 'test-peer-id',
        ...overrides,
    };
}

/**
 * Create a mock player.
 */
export function createMockPlayer(
    id: string,
    overrides: Partial<Player> = {}
): Player {
    return {
        id,
        name: `Player ${id}`,
        ready: false,
        ...overrides,
    };
}

/**
 * Create a mock game with N players in lobby state.
 */
export function createMockGameWithPlayers(playerCount: number): {
    game: Game;
    players: Player[];
} {
    const players: Player[] = [];
    for (let i = 0; i < playerCount; i++) {
        players.push(createMockPlayer(`player-${i}`));
    }
    const game = createMockGame({
        players: players.reduce(
            (acc, p) => {
                acc[p.id] = p;
                return acc;
            },
            {} as { [playerId: string]: Player }
        ),
    });
    return { game, players };
}
