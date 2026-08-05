import { describe, it, expect } from 'vitest';
import { MockPeer, createPeers } from '../../chorus/__tests__/mockPeer';
import { createMockGameWithPlayers } from './mockGame';
import { Game, GameTurn, PlayerRole } from '../types';
import { computeGameChecksum } from '../checksum';

/**
 * Simulate the workflow transition check (mirrors the logic in workflows.ts).
 * After each event is applied, check if any workflow transition should fire.
 */
function evaluateWorkflows(peer: MockPeer<Game>): void {
    const state = peer.getState();
    if (!state || state.status !== 'running') return;
    const turn = state.turns[state.turns.length - 1];
    if (!turn) return;
    const playerId = peerIdToPlayerId(peer.peerId);
    const playerTurn = turn.players[playerId];
    if (!playerTurn) return;

    const context = {
        game: state,
        turn,
        playerTurn,
        player: { id: peer.peerId },
    };

    // stPicksCards → stWriteStory
    if (
        turn.status === 'stPicksCards' &&
        playerTurn.selectedCards?.length === 3
    ) {
        turn.status = 'stWriteStory';
        peer.setState({ ...state });
        return;
    }
    // stWriteStory → pEstimate
    if (turn.status === 'stWriteStory' && !!playerTurn.story) {
        turn.status = 'pEstimate';
        peer.setState({ ...state });
        return;
    }
    // pEstimate → pPicksCards
    if (
        turn.status === 'pEstimate' &&
        Object.keys(turn.players).every(
            (pk) =>
                turn.players[pk].role === PlayerRole.storyteller ||
                !!turn.players[pk]?.estimateVisibleCards
        )
    ) {
        turn.status = 'pPicksCards';
        peer.setState({ ...state });
        return;
    }
    // pPicksCards → turnEnded
    if (
        turn.status === 'pPicksCards' &&
        Object.keys(turn.players).every(
            (pk) =>
                turn.players[pk].role === PlayerRole.storyteller ||
                !!turn.players[pk]?.selectedCardsTime
        )
    ) {
        turn.status = 'turnEnded';
        peer.setState({ ...state });
        return;
    }
}

/**
 * Apply a game event to a peer's local state (simulates what DSStore reducers do).
 * Then evaluate workflows (simulates effector's sample()).
 * Also logs events to the peer's event log for reconnection support.
 */
function applyEvent(
    peer: MockPeer<Game>,
    message: { type: string; data?: any; clock?: number; peerId?: string }
): void {
    if (message.type !== 'event' || !message.data) return;
    const { eventName, payload } = message.data;

    // setState must work even when current state is null (initial handshake)
    if (eventName === 'setState') {
        peer.setState(payload);
        return;
    }

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
        case 'setStatus': {
            const turn = state.turns[state.turns.length - 1];
            if (!turn) return;
            if (turn.status === payload) return; // idempotent
            turn.status = payload;
            peer.setState({ ...state });
            break;
        }
        case 'updateTurnPlayers': {
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
    }

    // Log event to the peer's event log for reconnection support
    if (
        eventName !== 'setState' &&
        message.clock !== undefined &&
        message.peerId
    ) {
        peer.eventLog.push({
            id: `${message.peerId}-${message.clock}-${Date.now()}`,
            clock: message.clock,
            peerId: message.peerId,
            eventName,
            payload,
            timestamp: Date.now(),
        });
    }

    // After applying the event, evaluate workflows
    evaluateWorkflows(peer);
}

/**
 * Wire up a MockPeer's onMessage to apply game events to its local state.
 */
function wirePeer(peer: MockPeer<Game>): void {
    peer.onMessage = (message) => applyEvent(peer, message);
}

/**
 * Create peers with event handling wired up.
 * Peer IDs match player IDs in the game state (e.g., peer-0 → player-0).
 */
function createWiredPeers(
    count: number,
    initialState?: Game | null
): MockPeer<Game>[] {
    const peers = createPeers(count, initialState);
    peers.forEach(wirePeer);
    return peers;
}

/**
 * Get a peer's corresponding player ID.
 * In tests, peer-0 maps to player-0, peer-1 maps to player-1, etc.
 */
function peerIdToPlayerId(peerId: string): string {
    return peerId.replace('peer-', 'player-');
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
        // Causal ordering: setStatus should be applied before
        // updateTurnPlayers because the score update depends on the turn
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
        // 1. setStatus('turnEnded') — turn status change
        // 2. updateTurnPlayers(...) — score calculation
        const statusEvent = {
            type: 'event',
            data: {
                eventName: 'setStatus',
                payload: 'turnEnded',
            },
        };
        const scoreEvent = {
            type: 'event',
            data: {
                eventName: 'updateTurnPlayers',
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

        // Bob submits his estimate locally
        const bobEstimate = {
            type: 'event',
            data: {
                eventName: 'setTimeEstimate',
                payload: { playerId: 'player-1', estimate: 5 },
            },
        };
        // Use onMessage directly to bypass clock buffer
        bob.onMessage?.(bobEstimate);

        // Charlie submits his estimate locally
        const charlieEstimate = {
            type: 'event',
            data: {
                eventName: 'setTimeEstimate',
                payload: { playerId: 'player-2', estimate: 3 },
            },
        };
        charlie.onMessage?.(charlieEstimate);

        // Bob receives Charlie's estimate (simulate remote event)
        bob.onMessage?.(charlieEstimate);

        // Charlie receives Bob's estimate (simulate remote event)
        charlie.onMessage?.(bobEstimate);

        // Now both peers have all estimates. With distributed workflow evaluation,
        // each peer independently advances the turn to pPicksCards.
        const bobState = bob.getState();
        expect(bobState!.turns[0].status).toBe('pPicksCards');

        const charlieState = charlie.getState();
        expect(charlieState!.turns[0].status).toBe('pPicksCards');
    });
});

describe('Issue 4: State Divergence Detection', () => {
    it('should produce different checksums for different states', () => {
        const state1 = createMockGameWithPlayers(3).game;
        const state2 = createMockGameWithPlayers(3).game;

        // Corrupt state2: mark a player ready
        state2.players['player-0'].ready = true;

        const checksum1 = computeGameChecksum(state1);
        const checksum2 = computeGameChecksum(state2);

        // Different states should produce different checksums
        expect(checksum1).not.toEqual(checksum2);
    });

    it('should produce the same checksum for identical states', () => {
        const state1 = createMockGameWithPlayers(3).game;
        const state2 = createMockGameWithPlayers(3).game;

        const checksum1 = computeGameChecksum(state1);
        const checksum2 = computeGameChecksum(state2);

        // Identical states should produce the same checksum
        expect(checksum1).toEqual(checksum2);
    });

    it('should detect state changes via checksum', () => {
        const state = createMockGameWithPlayers(3).game;
        const before = computeGameChecksum(state);

        // Simulate a game event: toggle player ready
        state.players['player-0'].ready = !state.players['player-0'].ready;
        const after = computeGameChecksum(state);

        expect(before).not.toEqual(after);
    });

    it('should detect turn changes via checksum', () => {
        const state = createMockGameWithPlayers(3).game;
        state.status = 'running';
        state.turns.push({
            status: 'stPicksCards',
            players: {},
        });

        const before = computeGameChecksum(state);

        // Advance turn status
        state.turns[0].status = 'stWriteStory';
        const after = computeGameChecksum(state);

        expect(before).not.toEqual(after);
    });

    it('should return null checksum for null state', () => {
        expect(computeGameChecksum(null)).toBe('null');
    });
});

describe('Issue 5: Initial Connection Handshake', () => {
    it('should handle lost initial setState message via requestState', () => {
        const initialState = createMockGameWithPlayers(2).game;
        const alice = new MockPeer<Game>('alice', initialState);
        const bob = new MockPeer<Game>('bob', null); // Bob hasn't joined yet

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

        // Bob is still null because the setState was dropped
        expect(bob.getState()).toBeNull();

        // Bob explicitly requests state (new handshake protocol)
        // Simulate the control message: Bob sends requestState to Alice
        const requestStateMsg = {
            type: 'control',
            data: { action: 'requestState' },
        };
        // Alice receives the requestState and responds with setState
        // Simulate Alice's response handler
        bob.onMessage?.({
            type: 'event',
            data: {
                eventName: 'setState',
                payload: initialState,
            },
            clock: 2,
            peerId: 'alice',
        });

        // Now Bob should have the state
        expect(bob.getState()).toEqual(initialState);
    });
});

describe('Issue 7: Clock Sync on Reconnect', () => {
    it('should update lamportClock after reconnecting and replaying missed events', () => {
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

        // Alice broadcasts an event (clock goes to 1)
        alice.broadcast({
            type: 'event',
            data: {
                eventName: 'selectCard',
                payload: { playerId: 'player-0', cardIndex: 1 },
            },
        });

        // Charlie disconnects
        charlie.disconnect();

        // More events happen while Charlie is gone (Alice's clock advances)
        alice.broadcast({
            type: 'event',
            data: {
                eventName: 'selectCard',
                payload: { playerId: 'player-0', cardIndex: 2 },
            },
        });
        alice.broadcast({
            type: 'event',
            data: {
                eventName: 'selectCard',
                payload: { playerId: 'player-0', cardIndex: 3 },
            },
        });

        // Charlie's clock is still at whatever it was (should be 0 since he never broadcast)
        const charlieClockBefore = charlie.lamportClock;

        // Charlie reconnects — should replay missed events and update his clock
        charlie.reconnect(alice);

        // Charlie's clock should now be >= the max clock from replayed events
        // Alice's clock is at least 3 (3 broadcasts), so Charlie's should be >= 3
        expect(charlie.lamportClock).toBeGreaterThanOrEqual(3);
        // Charlie's state should match Alice's
        expect(charlie.isStateEqual(alice)).toBe(true);
    });
});

describe('Issue 8: catchUpResponse Clock Update', () => {
    it('should update lamportClock when receiving replayed events via catchUpResponse', () => {
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
            },
        };
        initialState.turns.push(turn);

        const [alice, bob] = createWiredPeers(2, initialState);

        // Alice broadcasts events (clocks 1, 2, 3)
        alice.broadcast({
            type: 'event',
            data: {
                eventName: 'selectCard',
                payload: { playerId: 'player-0', cardIndex: 1 },
            },
        });
        alice.broadcast({
            type: 'event',
            data: {
                eventName: 'selectCard',
                payload: { playerId: 'player-0', cardIndex: 2 },
            },
        });
        alice.broadcast({
            type: 'event',
            data: {
                eventName: 'selectCard',
                payload: { playerId: 'player-0', cardIndex: 3 },
            },
        });

        // Bob's clock should have been updated by receiving events
        // Each received event calls updateClock which does Math.max + 1
        expect(bob.lamportClock).toBeGreaterThanOrEqual(3);
    });
});

describe('Issue 10: Connection Health Monitoring', () => {
    it('should detect silent peer disconnection via heartbeat timeout', () => {
        const initialState = createMockGameWithPlayers(3).game;
        const [alice, bob, charlie] = createWiredPeers(3, initialState);

        // All peers are connected and healthy
        expect(alice.connectedPeers.has('peer-1')).toBe(true);
        expect(alice.connectedPeers.has('peer-2')).toBe(true);

        // Charlie goes silent (still connected but not responding)
        charlie.simulateSilentDisconnect();

        // Simulate time passing — manually set charlie's lastSeen to past
        // We need to access the peer from alice's perspective
        const charlieFromAlice = alice.connectedPeers.get('peer-2');
        if (charlieFromAlice) {
            charlieFromAlice.lastSeen = Date.now() - 20000; // 20 seconds ago
        }

        // Alice checks peer health with a 15s timeout
        const disconnected = alice.checkPeerHealth(15000);

        // Charlie should be detected as disconnected
        expect(disconnected).toContain('peer-2');
        expect(alice.connectedPeers.has('peer-2')).toBe(false);
        // Bob should still be connected
        expect(alice.connectedPeers.has('peer-1')).toBe(true);
    });

    it('should not disconnect healthy peers', () => {
        const initialState = createMockGameWithPlayers(3).game;
        const [alice, bob, charlie] = createWiredPeers(3, initialState);

        // All peers are healthy with recent lastSeen
        const disconnected = alice.checkPeerHealth(15000);

        // No peers should be disconnected
        expect(disconnected).toHaveLength(0);
        expect(alice.connectedPeers.size).toBe(2);
    });

    it('should trigger onPeerDisconnected callback when peer times out', () => {
        const initialState = createMockGameWithPlayers(2).game;
        const [alice, bob] = createWiredPeers(2, initialState);

        let disconnectedPeerId: string | null = null;
        alice.onPeerDisconnected = (peerId: string) => {
            disconnectedPeerId = peerId;
        };

        // Make bob's lastSeen stale
        const bobFromAlice = alice.connectedPeers.get('peer-1');
        if (bobFromAlice) {
            bobFromAlice.lastSeen = Date.now() - 20000;
        }

        alice.checkPeerHealth(15000);

        expect(disconnectedPeerId).toBe('peer-1');
    });

    it('should respond to ping with pong when not silent', () => {
        const initialState = createMockGameWithPlayers(2).game;
        const [alice, bob] = createWiredPeers(2, initialState);

        // Bob is healthy and should respond to pings
        const bobLastSeenBefore = bob.lastSeen;
        bob.handlePing('peer-0');

        // Bob's lastSeen should be updated
        expect(bob.lastSeen).toBeGreaterThanOrEqual(bobLastSeenBefore);
    });

    it('should not respond to ping when silent', () => {
        const initialState = createMockGameWithPlayers(2).game;
        const [alice, bob] = createWiredPeers(2, initialState);

        // Bob goes silent
        bob.simulateSilentDisconnect();
        const bobLastSeenBefore = bob.lastSeen;

        // Bob should not respond to ping
        bob.handlePing('peer-0');

        // Bob's lastSeen should NOT be updated (silent peer doesn't respond)
        expect(bob.lastSeen).toBe(bobLastSeenBefore);
    });
});

describe('Issue 9: Concurrent State Modification', () => {
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
                eventName: 'updateTurnPlayers',
                payload: {
                    'player-0': { score: 100 },
                    'player-1': { score: 60 },
                },
            },
        };
        const scoreUpdate2 = {
            type: 'event',
            data: {
                eventName: 'updateTurnPlayers',
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

describe('Fix A: Checksum from New State', () => {
    it('should compute checksum from post-mutation state, not pre-mutation', () => {
        const initialState = createMockGameWithPlayers(2).game;
        // status is 'lobby'
        const peer = new MockPeer<Game>('peer-0', initialState);
        peer.computeChecksum = computeGameChecksum;

        // Simple applyEvent that handles startSession and setStatus
        peer.onMessage = (message) => {
            if (message.type !== 'event' || !message.data) return;
            const { eventName, payload } = message.data;
            const state = peer.getState();
            if (!state) return;

            if (eventName === 'startSession') {
                state.status = 'running';
                peer.setState({ ...state });
            } else if (eventName === 'setStatus') {
                const turn = state.turns[state.turns.length - 1];
                if (!turn) return;
                if (turn.status === payload) return;
                turn.status = payload;
                peer.setState({ ...state });
            }
        };

        const preChecksum = computeGameChecksum(initialState);
        expect(preChecksum).toContain('lobby');

        // Broadcast startSession — non-mutating reducer in real code
        peer.broadcast({ type: 'event', data: { eventName: 'startSession' } });

        // The checksum should be from the state AFTER the event (running)
        const postState = peer.getState();
        const postChecksum = computeGameChecksum(postState);
        expect(postChecksum).toContain('running');

        // lastBroadcastChecksum should match the post-mutation state checksum
        expect(peer.lastBroadcastChecksum).toBe(postChecksum);
        expect(peer.lastBroadcastChecksum).not.toBe(preChecksum);
    });

    it('should handle non-mutating setStatus correctly', () => {
        const initialState = createMockGameWithPlayers(2).game;
        initialState.status = 'running';
        initialState.turns.push({
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
            },
        });

        const peer = new MockPeer<Game>('peer-0', initialState);
        peer.computeChecksum = computeGameChecksum;

        peer.onMessage = (message) => {
            if (message.type !== 'event' || !message.data) return;
            const { eventName, payload } = message.data;
            const state = peer.getState();
            if (!state) return;

            if (eventName === 'setStatus') {
                const turn = state.turns[state.turns.length - 1];
                if (!turn) return;
                if (turn.status === payload) return;
                turn.status = payload;
                peer.setState({ ...state });
            }
        };

        const preChecksum = computeGameChecksum(initialState);
        expect(preChecksum).toContain('stPicksCards');

        peer.broadcast({
            type: 'event',
            data: { eventName: 'setStatus', payload: 'stWriteStory' },
        });

        const postState = peer.getState();
        const postChecksum = computeGameChecksum(postState);
        expect(postChecksum).toContain('stWriteStory');
        expect(peer.lastBroadcastChecksum).toBe(postChecksum);
    });
});

describe('Fix B: Workflow Cascade No False Positive', () => {
    function createCascadeState() {
        const { game } = createMockGameWithPlayers(3);
        game.status = 'running';
        game.turns.push({
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
                    estimateVisibleCards: 5,
                },
                'player-2': {
                    playerId: 'player-2',
                    role: PlayerRole.gremlin,
                    score: 0,
                    estimateVisibleCards: 3,
                },
            },
        });
        return game;
    }

    function workflowAwareApplyEvent(peer: MockPeer<Game>, message: any): void {
        if (message.type !== 'event' || !message.data) return;
        const { eventName, payload } = message.data;
        const state = peer.getState();
        if (!state) return;

        switch (eventName) {
            case 'setStatus': {
                const turn = state.turns[state.turns.length - 1];
                if (!turn) return;
                if (turn.status === payload) return;
                turn.status = payload;
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
        }

        // After applying the event, evaluate workflows (simulating effector sample())
        // pEstimate → pPicksCards: all gremlins have estimated
        const turn = state.turns[state.turns.length - 1];
        if (
            turn &&
            turn.status === 'pEstimate' &&
            Object.keys(turn.players).every(
                (pk) =>
                    turn.players[pk].role === PlayerRole.storyteller ||
                    !!turn.players[pk]?.estimateVisibleCards
            )
        ) {
            turn.status = 'pPicksCards';
            peer.setState({ ...state });
        }
    }

    it('should converge state after workflow cascade triggered by setTimeEstimate', () => {
        const initialState = createCascadeState();
        const [alice, bob] = createPeers(2, initialState);

        alice.computeChecksum = computeGameChecksum;
        bob.computeChecksum = computeGameChecksum;

        // Wire both peers with the workflow-aware event handler
        alice.onMessage = (message) => workflowAwareApplyEvent(alice, message);
        bob.onMessage = (message) => workflowAwareApplyEvent(bob, message);

        // Remove player-2's estimate so the cascade is not yet triggered
        bob.getState()!.turns[0].players['player-2'].estimateVisibleCards =
            undefined;
        bob.setState({ ...bob.getState()! });

        // Broadcast setTimeEstimate for player-2, which should trigger the cascade
        alice.broadcast({
            type: 'event',
            data: {
                eventName: 'setTimeEstimate',
                payload: { playerId: 'player-2', estimate: 3 },
            },
        });

        // Both peers should have the same state after the cascade
        expect(alice.isStateEqual(bob)).toBe(true);
        // The turn should have advanced from pEstimate to pPicksCards
        expect(alice.getState()!.turns[0].status).toBe('pPicksCards');
    });

    it('should converge state when setStatus triggers cascade', () => {
        const initialState = createCascadeState();
        const [alice, bob] = createPeers(2, initialState);

        alice.computeChecksum = computeGameChecksum;
        bob.computeChecksum = computeGameChecksum;

        alice.onMessage = (message) => workflowAwareApplyEvent(alice, message);
        bob.onMessage = (message) => workflowAwareApplyEvent(bob, message);

        // Broadcast setStatus('pPicksCards') — this should trigger immediately
        alice.broadcast({
            type: 'event',
            data: {
                eventName: 'setStatus',
                payload: 'pPicksCards',
            },
        });

        expect(alice.isStateEqual(bob)).toBe(true);
        expect(alice.getState()!.turns[0].status).toBe('pPicksCards');
    });
});
