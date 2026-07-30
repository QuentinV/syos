import { Game, Player } from '../../state/types';

export type MessageHandler = (message: {
    type: string;
    data?: any;
    clock?: number;
    peerId?: string;
    checksum?: string;
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
        message: {
            type: string;
            data?: any;
            clock: number;
            peerId: string;
            checksum?: string;
        };
    }[] = [];
    private flushTimeoutId: ReturnType<typeof setTimeout> | null = null;

    // Event log for reconnection support
    public eventLog: {
        id: string;
        clock: number;
        peerId: string;
        eventName: string;
        payload: any;
        timestamp: number;
    }[] = [];

    // Connection health monitoring
    public lastSeen: number = Date.now();
    public isSilent = false; // When true, peer doesn't respond to pings
    private heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;
    private healthCheckIntervalId: ReturnType<typeof setInterval> | null = null;
    public onPeerDisconnected: ((peerId: string) => void) | null = null;

    // Checksum support for divergence detection (Fix A, B, C)
    public computeChecksum: ((state: Game | null) => string) | null = null;
    public broadcastCount = 0;
    public divergenceWarnings: string[] = [];
    public lastBroadcastChecksum: string | null = null;

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
        this.stopHeartbeat();
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

    /**
     * Simulate a silent disconnect — peer is still "connected" but
     * doesn't respond to pings. Used to test health monitoring.
     */
    simulateSilentDisconnect(): void {
        this.isSilent = true;
    }

    /**
     * Send a ping to all connected peers.
     */
    sendPing(): void {
        if (this.isDisconnected) return;
        this.connectedPeers.forEach((peer) => {
            if (peer.isDisconnected) return;
            peer.receiveMessage(this.peerId, {
                type: 'control',
                data: { action: 'ping' },
                peerId: this.peerId,
            });
        });
    }

    /**
     * Handle a ping by responding with pong (unless silent).
     */
    handlePing(fromPeerId: string): void {
        if (this.isSilent) return; // Silent peers don't respond
        const peer = this.connectedPeers.get(fromPeerId);
        if (peer && !peer.isDisconnected) {
            this.lastSeen = Date.now();
            peer.receiveMessage(this.peerId, {
                type: 'control',
                data: { action: 'pong' },
                peerId: this.peerId,
            });
        }
    }

    /**
     * Check health of all connected peers.
     * Returns list of peer IDs that have timed out.
     */
    checkPeerHealth(timeoutMs = 15000): string[] {
        const now = Date.now();
        const disconnected: string[] = [];
        this.connectedPeers.forEach((peer, peerId) => {
            if (now - peer.lastSeen > timeoutMs) {
                disconnected.push(peerId);
                this.connectedPeers.delete(peerId);
                this.onPeerDisconnected?.(peerId);
            }
        });
        return disconnected;
    }

    /**
     * Start sending heartbeats and checking peer health.
     */
    startHeartbeat(intervalMs = 5000): void {
        if (this.heartbeatIntervalId) return;
        this.heartbeatIntervalId = setInterval(() => {
            this.sendPing();
        }, intervalMs);
        this.healthCheckIntervalId = setInterval(() => {
            this.checkPeerHealth();
        }, intervalMs);
    }

    /**
     * Stop heartbeat intervals.
     */
    stopHeartbeat(): void {
        if (this.heartbeatIntervalId) {
            clearInterval(this.heartbeatIntervalId);
            this.heartbeatIntervalId = null;
        }
        if (this.healthCheckIntervalId) {
            clearInterval(this.healthCheckIntervalId);
            this.healthCheckIntervalId = null;
        }
    }

    reconnect(existingPeer: MockPeer): void {
        this.isDisconnected = false;
        this.connect(existingPeer);

        // Request missed events since our last known clock
        const sinceClock = this.lamportClock;
        // Simulate the control message protocol
        // The reconnecting peer sends a catchUpRequest
        const missedEvents = existingPeer.eventLog.filter(
            (e) => e.clock > sinceClock
        );

        // Find the max clock among missed events to sync our clock
        let maxMissedClock = 0;
        for (const entry of missedEvents) {
            if (entry.clock > maxMissedClock) maxMissedClock = entry.clock;
        }

        // Sync our Lamport clock to at least the max clock we've seen
        if (maxMissedClock > 0) {
            this.lamportClock = Math.max(this.lamportClock, maxMissedClock);
        }

        // Apply missed events directly (bypass buffer since we're catching up)
        for (const entry of missedEvents) {
            const stamped = {
                type: 'event',
                data: { eventName: entry.eventName, payload: entry.payload },
                clock: entry.clock,
                peerId: entry.peerId,
            };
            this.messageLog.push({ from: entry.peerId, message: stamped });
            this.onMessage?.(stamped);
        }

        // Also send a requestState to get the current snapshot
        const stateSnapshot = {
            type: 'event',
            data: { eventName: 'setState', payload: existingPeer.getState() },
            clock: existingPeer.lamportClock,
            peerId: existingPeer.peerId,
        };
        this.messageLog.push({
            from: existingPeer.peerId,
            message: stateSnapshot,
        });
        this.onMessage?.(stateSnapshot);
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
        const stamped: {
            type: string;
            data?: any;
            clock: number;
            peerId: string;
            checksum?: string;
        } = {
            ...message,
            clock: this.lamportClock,
            peerId: this.peerId,
        };

        // Apply locally first (simulates the local reducer execution)
        this.messageLog.push({ from: this.peerId, message: stamped });
        this.onMessage?.(stamped);

        // Compute checksum from the post-mutation state (Fix A: use new state, not old)
        if (this.computeChecksum && this.state) {
            stamped.checksum = this.computeChecksum(this.state);
            this.lastBroadcastChecksum = stamped.checksum;
        }

        this.broadcastCount++;

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

            // Verify checksum after all synchronous processing (including workflow cascades)
            if (
                message.checksum !== undefined &&
                this.computeChecksum &&
                this.state
            ) {
                const localChecksum = this.computeChecksum(this.state);
                if (localChecksum !== message.checksum) {
                    this.divergenceWarnings.push(
                        `[DIVERGENCE] Event "${message.data?.eventName}" caused state divergence. ` +
                            `Expected: ${message.checksum}, local: ${localChecksum}`
                    );
                }
            }
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
