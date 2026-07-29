import { Game, GameTurnStatus, Player, PlayerRole } from '../../state/types';

export type MessageHandler = (message: { type: string; data?: any }) => void;

/**
 * In-memory mock of a PeerJS peer for testing P2P sync without WebRTC.
 * Each MockPeer has its own DSStore-like state and can connect to other peers.
 */
export class MockPeer {
    public peerId: string;
    public state: Game | null = null;
    public connectedPeers: Map<string, MockPeer> = new Map();
    public messageLog: { from: string; message: any }[] = [];
    public isDisconnected = false;
    public dropNextMessage = false;
    public reorderMode: 'in-order' | 'reverse' | 'random' = 'in-order';
    public onMessage: MessageHandler | null = null;
    public onConnection: ((peer: MockPeer) => void) | null = null;
    private pendingMessages: { from: string; message: any }[] = [];

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
    }

    reconnect(existingPeer: MockPeer): void {
        this.isDisconnected = false;
        this.connect(existingPeer);
    }

    /**
     * Broadcast a message to all connected peers.
     * Simulates network delay and out-of-order delivery based on reorderMode.
     */
    broadcast(message: { type: string; data?: any }): void {
        if (this.isDisconnected) return;

        this.connectedPeers.forEach((peer, peerId) => {
            if (peer.isDisconnected) return;

            if (this.dropNextMessage) {
                this.dropNextMessage = false;
                return;
            }

            const deliveryOrder =
                this.reorderMode === 'reverse'
                    ? [...this.connectedPeers.entries()].reverse()
                    : this.reorderMode === 'random'
                      ? [...this.connectedPeers.entries()].sort(
                            () => Math.random() - 0.5
                        )
                      : [...this.connectedPeers.entries()];

            deliveryOrder.forEach(([id, p]) => {
                if (p.isDisconnected) return;
                p.receiveMessage(this.peerId, message);
            });
        });
    }

    receiveMessage(from: string, message: { type: string; data?: any }): void {
        if (this.isDisconnected) return;
        this.messageLog.push({ from, message });
        this.onMessage?.(message);
    }

    /**
     * Simulate receiving events in a specific order from multiple peers.
     * Used to test out-of-order delivery scenarios.
     */
    receiveInOrder(peerOrder: string[]): void {
        const messages = this.pendingMessages;
        this.pendingMessages = [];
        peerOrder.forEach((peerId) => {
            const msgs = messages.filter((m) => m.from === peerId);
            msgs.forEach((m) => this.receiveMessage(m.from, m.message));
        });
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
