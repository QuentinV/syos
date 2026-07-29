import { describe, it, expect } from 'vitest';
import {
    MockPeer,
    createPeers,
    createMockGameWithPlayers,
} from '../../utils/__tests__/mockPeer';
import { Game, GameTurn, PlayerRole } from '../types';

/**
 * Apply a game event to a peer's local state (simulates what DSStore reducers do).
 */
function applyEvent(
    peer: MockPeer,
    message: { type: string; data?: any }
): void {
    if (message.type !== 'event' || !message.data) return;
    const { eventName, payload } = message.data;
    const state = peer.getState();
    if (!state) return;

    switch (eventName) {
        case 'selectCard': {
            const { playerId, cardIndex } = payload;
            const turn = state.turns[state.turns.length - 1];
            if (!turn || !turn.players[playerId]) return;
            const playerTurn = turn.players[playerId];
            playerTurn.selectedCards = [
                ...new Set([...(playerTurn.selectedCards ?? []), cardIndex]),
            ];
            peer.setState({ ...state });
            break;
        }
        case 'setDisplayedCards': {
            const { playerId, cardIndexes } = payload;
            const turn = state.turns[state.turns.length - 1];
            if (!turn || !turn.players[playerId]) return;
            turn.players[playerId].displayedCards = cardIndexes;
            turn.players[playerId].displayedCardsTime = Date.now();
            peer.setState({ ...state });
            break;
        }
        case 'setTimeEstimate': {
            const { playerId, estimate } = payload;
            const turn = state.turns[state.turns.length - 1];
            if (!turn || !turn.players[playerId]) return;
            turn.players[playerId].estimateVisibleCards = estimate;
            peer.setState({ ...state });
            break;
        }
        case 'setGameTurnStatus': {
            const turn = state.turns[state.turns.length - 1];
            if (!turn) return;
            turn.status = payload;
            peer.setState({ ...state });
            break;
        }
        case 'updatePlayersTurn': {
            const turn = state.turns[state.turns.length - 1];
            if (!turn) return;
            Object.keys(payload).forEach((pk) => {
                if (turn.players[pk]) {
                    turn.players[pk] = { ...turn.players[pk], ...payload[pk] };
                }
            });
            peer.setState({ ...state });
            break;
        }
        case 'setState': {
            peer.setState(payload);
            break;
        }
    }
}

/**
 * Wire up a MockPeer's onMessage to apply game events to its local state.
 */
function wirePeer(peer: MockPeer): void {
    peer.onMessage = (message) => applyEvent(peer, message);
}

/**
 * Create peers with event handling wired up.
 */
function createWiredPeers(
    count: number,
    initialState?: Game | null
): MockPeer[] {
    const peers = createPeers(count, initialState);
    peers.forEach(wirePeer);
    return peers;
}

/**
 * Issue-specific tests that demonstrate the architectural problems
 * identified in docs/architecture-review.md.
 */

describe('Issue 1: Event Ordering (Multi-Source)', () => {
    it('should converge when events target different player slots', () => {
        // Even without a Lamport clock, events targeting disjoint state
        // should converge because there's no conflict.
        const initialState = createMockGameWithPlayers(3).game;
        initialState.status = 'running';
        const turn: GameTurn = {
            status: 'pEstimate',
            players: {
                'player-0': {
                    playerId: 'player-0',
                    role: PlayerRole.storyteller,
                    score: 0,
                },
                'player-1': {
                    playerId: 'player-1',
                    role: PlayerRole.gremlin,
                    score: 0,
                },
                'player-2': {
                    playerId: 'player-2',
                    role: PlayerRole.gremlin,
                    score: 0,
                },
            },
        };
        initialState.turns.push(turn);

        const [alice, bob] = createWiredPeers(2, initialState);

        // Two events targeting different player slots — no conflict expected
        const aliceEvent = {
            type: 'event',
            data: {
                eventName: 'setDisplayedCards',
                payload: { playerId: 'player-0', cardIndexes: [1, 2, 3] },
            },
        };
        const bobEvent = {
            type: 'event',
            data: {
                eventName: 'setTimeEstimate',
                payload: { playerId: 'player-1', estimate: 5 },
            },
        };

        // Use broadcast() which stamps with Lamport clock
        alice.broadcast(aliceEvent);
        bob.broadcast(bobEvent);

        const aliceState = alice.getState();
        const bobState = bob.getState();
        expect(aliceState).toEqual(bobState);
    });

    it('should converge when events target the same player slot in order', () => {
        // Two events from the same source targeting the same player's cards
        const initialState = createMockGameWithPlayers(3).game;
        initialState.status = 'running';
        const turn: GameTurn = {
            status: 'stPicksCards',
            players: {
                'player-0': {
                    playerId: 'player-0',
                    role: PlayerRole.storyteller,
                    score: 0,
                    selectedCards: [],
                },
            },
        };
        initialState.turns.push(turn);

        const [alice, bob] = createWiredPeers(2, initialState);

        const firstPick = {
            type: 'event',
            data: {
                eventName: 'selectCard',
                payload: { playerId: 'player-0', cardIndex: 1 },
            },
        };
        const secondPick = {
            type: 'event',
            data: {
                eventName: 'selectCard',
                payload: { playerId: 'player-0', cardIndex: 2 },
            },
        };

        // Emit in order: first, then second
        alice.broadcast(firstPick);
        alice.broadcast(secondPick);

        // Both peers should have selectedCards = [1, 2]
        const aliceTurn = alice.getState()!.turns[0].players['player-0'];
        expect(aliceTurn.selectedCards).toEqual([1, 2]);

        const bobTurn = bob.getState()!.turns[0].players['player-0'];
        expect(bobTurn.selectedCards).toEqual([1, 2]);
    });

    it('should converge when events arrive out of order across peers', () => {
        // Causal ordering: setGameTurnStatus should be applied before
        // updatePlayersTurn because the score update depends on the turn
        // having ended. The Lamport clock ensures this order.
        const initialState = createMockGameWithPlayers(3).game;
        initialState.status = 'running';
        const turn: GameTurn = {
            status: 'pPicksCards',
            players: {
                'player-0': {
                    playerId: 'player-0',
                    role: PlayerRole.storyteller,
                    score: 0,
                    selectedCards: [1, 2, 3],
                },
                'player-1': {
                    playerId: 'player-1',
                    role: PlayerRole.gremlin,
                    score: 0,
                    selectedCards: [1, 2, 3],
                    selectedCardsTime: 2000,
                    displayedCardsTime: 1000,
                },
                'player-2': {
                    playerId: 'player-2',
                    role: PlayerRole.gremlin,
                    score: 0,
                    selectedCards: [4, 5, 6],
                    selectedCardsTime: 2000,
                    displayedCardsTime: 1000,
                },
            },
        };
        initialState.turns.push(turn);

        const [alice, bob] = createWiredPeers(2, initialState);

        // Alice emits two events in order:
        // 1. setGameTurnStatus('turnEnded') — turn status change
        // 2. updatePlayersTurn(...) — score calculation
        const statusEvent = {
            type: 'event',
            data: {
                eventName: 'setGameTurnStatus',
                payload: 'turnEnded',
            },
        };
        const scoreEvent = {
            type: 'event',
            data: {
                eventName: 'updatePlayersTurn',
                payload: {
                    'player-0': { score: 100, speed: 0.5 },
                    'player-1': { score: 80, speed: 0.8 },
                    'player-2': { score: 20, speed: 0.2 },
                },
            },
        };

        // Alice broadcasts both (stamped with clock 1, then clock 2)
        alice.broadcast(statusEvent);
        alice.broadcast(scoreEvent);

        // Both peers should have turn status 'turnEnded' and scores applied
        const aliceState = alice.getState();
        const bobState = bob.getState();

        expect(aliceState!.turns[0].status).toBe('turnEnded');
        expect(bobState!.turns[0].status).toBe('turnEnded');
        expect(aliceState!.turns[0].players['player-0'].score).toBe(100);
        expect(bobState!.turns[0].players['player-0'].score).toBe(100);
    });
});

describe('Issue 2: Reconnection & State Reconciliation', () => {
    it('should reconcile state after a peer reconnects', () => {
        const initialState = createMockGameWithPlayers(3).game;
        initialState.status = 'running';
        const turn: GameTurn = {
            status: 'stPicksCards',
            players: {
                'player-0': {
                    playerId: 'player-0',
                    role: PlayerRole.storyteller,
                    score: 0,
                },
                'player-1': {
                    playerId: 'player-1',
                    role: PlayerRole.gremlin,
                    score: 0,
                },
                'player-2': {
                    playerId: 'player-2',
                    role: PlayerRole.gremlin,
                    score: 0,
                },
            },
        };
        initialState.turns.push(turn);

        const [alice, bob, charlie] = createWiredPeers(3, initialState);

        // Charlie disconnects
        charlie.disconnect();

        // Events happen while Charlie is gone
        const pickCardsEvent = {
            type: 'event',
            data: {
                eventName: 'selectCard',
                payload: { playerId: 'player-0', cardIndex: 1 },
            },
        };
        alice.broadcast(pickCardsEvent);

        // Charlie reconnects to Alice
        charlie.reconnect(alice);

        // EXPECTED FAILURE: Charlie only gets the current snapshot from Alice,
        // but there's no mechanism to verify it's the latest or to replay
        // missed events. Charlie's state may be stale.
        expect(charlie.isStateEqual(alice)).toBe(true);
    });
});

describe('Issue 3: Workflow — Storyteller Disconnect', () => {
    it('should not stall when storyteller disconnects mid-turn', () => {
        const initialState = createMockGameWithPlayers(3).game;
        initialState.status = 'running';
        const turn: GameTurn = {
            status: 'pEstimate',
            players: {
                'player-0': {
                    playerId: 'player-0',
                    role: PlayerRole.storyteller,
                    score: 0,
                },
                'player-1': {
                    playerId: 'player-1',
                    role: PlayerRole.gremlin,
                    score: 0,
                },
                'player-2': {
                    playerId: 'player-2',
                    role: PlayerRole.gremlin,
                    score: 0,
                },
            },
        };
        initialState.turns.push(turn);

        const [alice, bob, charlie] = createWiredPeers(3, initialState);

        // Alice (storyteller) disconnects
        alice.disconnect();

        // Bob and Charlie submit their estimates
        const bobEstimate = {
            type: 'event',
            data: {
                eventName: 'setTimeEstimate',
                payload: { playerId: 'player-1', estimate: 5 },
            },
        };
        const charlieEstimate = {
            type: 'event',
            data: {
                eventName: 'setTimeEstimate',
                payload: { playerId: 'player-2', estimate: 3 },
            },
        };

        bob.broadcast(bobEstimate);
        charlie.broadcast(charlieEstimate);

        // EXPECTED FAILURE: The turn status never advances because only
        // the storyteller (Alice) evaluates workflow transitions.
        // Bob and Charlie are stuck in 'pEstimate' forever.
        const bobState = bob.getState();
        expect(bobState!.turns[0].status).toBe('pPicksCards');
    });
});

describe('Issue 4: State Divergence Detection', () => {
    it('should detect when peers have diverged states', () => {
        const initialState = createMockGameWithPlayers(3).game;
        const [alice, bob] = createWiredPeers(2, initialState);

        // Bob's state gets corrupted (simulating a bug or race condition)
        bob.corruptState({
            players: {
                ...initialState.players,
                'player-0': {
                    ...initialState.players['player-0'],
                    ready: true, // Alice's player is marked ready without her consent
                },
            },
        });

        // EXPECTED FAILURE: No divergence detection exists.
        // Bob's corrupt state goes unnoticed by Alice.
        const areEqual = alice.isStateEqual(bob);
        expect(areEqual).toBe(true);
    });
});

describe('Issue 5: Initial Connection Handshake', () => {
    it('should handle lost initial setState message', () => {
        const initialState = createMockGameWithPlayers(2).game;
        const alice = new MockPeer('alice', initialState);
        const bob = new MockPeer('bob', null); // Bob hasn't joined yet

        wirePeer(alice);
        wirePeer(bob);

        // Bob tries to connect to Alice
        alice.connect(bob);

        // Alice sends setState but it's dropped
        alice.dropNextMessage = true;
        alice.broadcast({
            type: 'event',
            data: {
                eventName: 'setState',
                payload: initialState,
            },
        });

        // EXPECTED FAILURE: Bob never received the initial state.
        // He's stuck with null/default state.
        expect(bob.getState()).toEqual(initialState);
    });
});

describe('Issue 6: Concurrent State Modification', () => {
    it('should handle concurrent score updates without data loss', () => {
        const initialState = createMockGameWithPlayers(3).game;
        initialState.status = 'running';
        const turn: GameTurn = {
            status: 'turnEnded',
            players: {
                'player-0': {
                    playerId: 'player-0',
                    role: PlayerRole.storyteller,
                    score: 50,
                },
                'player-1': {
                    playerId: 'player-1',
                    role: PlayerRole.gremlin,
                    score: 30,
                },
                'player-2': {
                    playerId: 'player-2',
                    role: PlayerRole.gremlin,
                    score: 20,
                },
            },
        };
        initialState.turns.push(turn);

        const [alice, bob] = createWiredPeers(2, initialState);

        // Two peers broadcast score updates simultaneously
        const scoreUpdate1 = {
            type: 'event',
            data: {
                eventName: 'updatePlayersTurn',
                payload: {
                    'player-0': { score: 100 },
                    'player-1': { score: 60 },
                },
            },
        };
        const scoreUpdate2 = {
            type: 'event',
            data: {
                eventName: 'updatePlayersTurn',
                payload: {
                    'player-1': { score: 70 },
                    'player-2': { score: 50 },
                },
            },
        };

        // Both broadcast — clock stamps ensure deterministic ordering
        alice.broadcast(scoreUpdate1);
        bob.broadcast(scoreUpdate2);

        // With Lamport clock, both peers should converge to the same state
        expect(alice.isStateEqual(bob)).toBe(true);
    });
});
