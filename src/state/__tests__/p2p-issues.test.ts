import { describe, it, expect, beforeEach } from 'vitest';
import {
    MockPeer,
    createPeers,
    createMockGameWithPlayers,
} from '../../utils/__tests__/mockPeer';
import { Game, GameTurn, PlayerRole } from '../types';

/**
 * Issue-specific tests that demonstrate the architectural problems
 * identified in docs/architecture-review.md.
 *
 * These tests are expected to FAIL with the current implementation
 * and should PASS once the corresponding fixes are applied.
 */

describe('Issue 1: Event Ordering (Multi-Source)', () => {
    it('should converge when events arrive in different orders', () => {
        // Three peers start with the same initial state
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

        const [alice, bob, charlie] = createPeers(3, initialState);

        // Alice and Bob emit events at the same time
        // Alice (storyteller) sets displayed cards
        // Bob (gremlin) submits an estimate
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

        // Simulate out-of-order delivery to Charlie
        // Bob's event arrives first, then Alice's
        charlie.receiveMessage('bob', bobEvent);
        charlie.receiveMessage('alice', aliceEvent);

        // Alice receives in order (her own first, then Bob's)
        alice.receiveMessage('alice', aliceEvent);
        alice.receiveMessage('bob', bobEvent);

        // Bob receives in order (his own first, then Alice's)
        bob.receiveMessage('bob', bobEvent);
        bob.receiveMessage('alice', aliceEvent);

        // EXPECTED FAILURE: Charlie's state may differ because events
        // were applied in a different order. With per-player state slots
        // this might actually work, but if events touch overlapping state
        // (e.g., turn status), divergence occurs.
        // After fix (Lamport clock): all peers should have identical state
        const aliceState = alice.getState();
        const charlieState = charlie.getState();
        expect(aliceState).toEqual(charlieState);
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

        const [alice, bob, charlie] = createPeers(3, initialState);

        // Charlie disconnects
        charlie.disconnect();

        // Events happen while Charlie is gone
        // Alice picks 3 cards
        const pickCardsEvent = {
            type: 'event',
            data: {
                eventName: 'selectCard',
                payload: { playerId: 'player-0', cardIndex: 1 },
            },
        };
        alice.receiveMessage('alice', pickCardsEvent);
        bob.receiveMessage('alice', pickCardsEvent);

        // Charlie reconnects to Alice
        charlie.reconnect(alice);

        // EXPECTED FAILURE: Charlie only gets the current snapshot from Alice,
        // but there's no mechanism to verify it's the latest or to replay
        // missed events. Charlie's state may be stale.
        // After fix (event log + catch-up): Charlie should have all events
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

        const [alice, bob, charlie] = createPeers(3, initialState);

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

        bob.receiveMessage('bob', bobEstimate);
        bob.receiveMessage('charlie', charlieEstimate);
        charlie.receiveMessage('bob', bobEstimate);
        charlie.receiveMessage('charlie', charlieEstimate);

        // EXPECTED FAILURE: The turn status never advances because only
        // the storyteller (Alice) evaluates workflow transitions.
        // Bob and Charlie are stuck in 'pEstimate' forever.
        // After fix (leader election): Bob or Charlie should take over
        // workflow evaluation and advance the turn.
        const bobState = bob.getState();
        expect(bobState!.turns[0].status).toBe('pPicksCards');
    });
});

describe('Issue 4: State Divergence Detection', () => {
    it('should detect when peers have diverged states', () => {
        const initialState = createMockGameWithPlayers(3).game;
        const [alice, bob] = createPeers(2, initialState);

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
        // After fix (checksum verification): Alice should detect the divergence
        const areEqual = alice.isStateEqual(bob);
        expect(areEqual).toBe(true);
    });
});

describe('Issue 5: Initial Connection Handshake', () => {
    it('should handle lost initial setState message', () => {
        const initialState = createMockGameWithPlayers(2).game;
        const alice = new MockPeer('alice', initialState);
        const bob = new MockPeer('bob', null); // Bob hasn't joined yet

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
        // After fix (ack-based handshake): Bob should retry or request state again
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

        const [alice, bob, charlie] = createPeers(3, initialState);

        // Two peers try to update scores simultaneously
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

        // Alice receives update1 first, then update2
        alice.receiveMessage('alice', scoreUpdate1);
        alice.receiveMessage('bob', scoreUpdate2);

        // Bob receives update2 first, then update1
        bob.receiveMessage('bob', scoreUpdate2);
        bob.receiveMessage('alice', scoreUpdate1);

        // EXPECTED FAILURE: Alice and Bob may have different final scores
        // because the updates were applied in different orders.
        // After fix (per-field merge or Lamport clock): both should converge
        expect(alice.isStateEqual(bob)).toBe(true);
    });
});
