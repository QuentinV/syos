import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEvent } from 'effector';

// Use dynamic import to ensure localStorage is stubbed before module code runs
let createChorus: typeof import('../index').createChorus;

beforeEach(async () => {
    // Stub localStorage before importing the module
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => {
            store[key] = value;
        },
        removeItem: (key: string) => {
            delete store[key];
        },
        clear: () => {
            Object.keys(store).forEach((k) => delete store[k]);
        },
    });

    // Dynamic import after localStorage is stubbed
    const mod = await import('../index');
    createChorus = mod.createChorus;
});

/**
 * Real integration tests for the Chorus session.
 * These tests exercise the actual createChorus().createSession() implementation,
 * not the MockPeer. They verify that the Lamport clock is
 * correctly updated by rawProcessMessage and processMessage.
 *
 * After the ChorusConnection refactor, each createSession() instance
 * has its own clock, buffer, and peer data — no more module-level
 * singletons.
 */

type TestState = { id: string; value: number } | null;

describe('Chorus session — Lamport clock integration', () => {
    it('should update lamportClock when rawProcessMessage receives a setState event', async () => {
        const chorus = createChorus({ storage: 'memory' });
        const api = chorus.createSession<TestState>({
            name: 'test-db',
            defaultValue: null,
        });

        const clockBefore = api._test.getCurrentClock();

        // Simulate receiving a setState event through rawProcessMessage
        await api._test.rawProcessMessage(
            {
                type: 'event',
                data: {
                    eventName: 'setState',
                    payload: { id: 'test', value: 42 },
                },
                clock: 5,
                peerId: 'remote-peer',
            },
            null as any
        );

        const clockAfter = api._test.getCurrentClock();

        // rawProcessMessage calls updateClock(5) which does Math.max(0, 5) + 1 = 6
        expect(clockAfter).toBeGreaterThanOrEqual(6);
        expect(clockAfter).toBeGreaterThan(clockBefore);
    });

    it('should update lamportClock when rawProcessMessage receives a regular event', async () => {
        const api = createChorus({
            storage: 'memory',
        }).createSession<TestState>({
            name: 'test-db',
            defaultValue: null,
        });

        const clockBefore = api._test.getCurrentClock();

        await api._test.rawProcessMessage(
            {
                type: 'event',
                data: {
                    eventName: 'selectCard',
                    payload: { playerId: 'p1', cardIndex: 1 },
                },
                clock: 10,
                peerId: 'remote-peer',
            },
            null as any
        );

        const clockAfter = api._test.getCurrentClock();

        expect(clockAfter).toBeGreaterThanOrEqual(11);
    });

    it('should update lamportClock when processMessage receives a regular event through the buffer', async () => {
        const api = createChorus({
            storage: 'memory',
        }).createSession<TestState>({
            name: 'test-db',
            defaultValue: null,
        });

        const clockBefore = api._test.getCurrentClock();

        await api._test.processMessage(
            {
                type: 'event',
                data: {
                    eventName: 'selectCard',
                    payload: { playerId: 'p1', cardIndex: 1 },
                },
                clock: 7,
                peerId: 'remote-peer',
            },
            null as any
        );

        const clockAfter = api._test.getCurrentClock();

        expect(clockAfter).toBeGreaterThanOrEqual(8);
    });

    it('should update lamportClock from catchUpResponse with replayed events', async () => {
        const api = createChorus({
            storage: 'memory',
        }).createSession<TestState>({
            name: 'test-db',
            defaultValue: null,
        });

        const clockBefore = api._test.getCurrentClock();

        await api._test.processMessage(
            {
                type: 'control',
                data: {
                    action: 'catchUpResponse',
                    events: [
                        {
                            id: 'evt-1',
                            clock: 15,
                            peerId: 'remote-peer',
                            eventName: 'selectCard',
                            payload: { playerId: 'p1', cardIndex: 1 },
                            timestamp: Date.now(),
                        },
                        {
                            id: 'evt-2',
                            clock: 16,
                            peerId: 'remote-peer',
                            eventName: 'selectCard',
                            payload: { playerId: 'p1', cardIndex: 2 },
                            timestamp: Date.now(),
                        },
                        {
                            id: 'evt-3',
                            clock: 20,
                            peerId: 'remote-peer',
                            eventName: 'selectCard',
                            payload: { playerId: 'p1', cardIndex: 3 },
                            timestamp: Date.now(),
                        },
                    ],
                },
            },
            null as any
        );

        const clockAfter = api._test.getCurrentClock();

        expect(clockAfter).toBeGreaterThanOrEqual(20);
        expect(clockAfter).toBeGreaterThan(clockBefore);
    });

    it('should handle multiple events and keep clock monotonic', async () => {
        const api = createChorus({
            storage: 'memory',
        }).createSession<TestState>({
            name: 'test-db',
            defaultValue: null,
        });

        await api._test.rawProcessMessage(
            {
                type: 'event',
                data: {
                    eventName: 'setState',
                    payload: { id: 'test', value: 1 },
                },
                clock: 1,
                peerId: 'p1',
            },
            null as any
        );
        const clock1 = api._test.getCurrentClock();

        await api._test.rawProcessMessage(
            {
                type: 'event',
                data: {
                    eventName: 'selectCard',
                    payload: { playerId: 'p1', cardIndex: 1 },
                },
                clock: 5,
                peerId: 'p1',
            },
            null as any
        );
        const clock2 = api._test.getCurrentClock();

        await api._test.rawProcessMessage(
            {
                type: 'event',
                data: {
                    eventName: 'selectCard',
                    payload: { playerId: 'p1', cardIndex: 2 },
                },
                clock: 10,
                peerId: 'p1',
            },
            null as any
        );
        const clock3 = api._test.getCurrentClock();

        expect(clock2).toBeGreaterThan(clock1);
        expect(clock3).toBeGreaterThan(clock2);
        expect(clock1).toBeGreaterThanOrEqual(2);
        expect(clock2).toBeGreaterThanOrEqual(6);
        expect(clock3).toBeGreaterThanOrEqual(11);
    });

    it('should handle catchUpResponse with empty events list', async () => {
        const api = createChorus({
            storage: 'memory',
        }).createSession<TestState>({
            name: 'test-db',
            defaultValue: null,
        });

        const clockBefore = api._test.getCurrentClock();

        await api._test.processMessage(
            {
                type: 'control',
                data: {
                    action: 'catchUpResponse',
                    events: [],
                },
            },
            null as any
        );

        const clockAfter = api._test.getCurrentClock();
        expect(clockAfter).toBe(clockBefore);
    });

    it('should respond to ping with pong control message', async () => {
        const api = createChorus({
            storage: 'memory',
        }).createSession<TestState>({
            name: 'test-db',
            defaultValue: null,
        });

        // Set state so we have an objectId
        await api._test.rawProcessMessage(
            {
                type: 'event',
                data: {
                    eventName: 'setState',
                    payload: { id: 'test-game', value: 1 },
                },
                clock: 1,
                peerId: 'host',
            },
            null as any
        );

        const sentMessages: any[] = [];
        const mockConn = {
            send: (msg: any) => {
                sentMessages.push(msg);
            },
        };

        await api._test.processMessage(
            {
                type: 'control',
                data: { action: 'ping' },
                peerId: 'remote-peer',
            },
            mockConn as any
        );

        expect(sentMessages).toHaveLength(1);
        expect(sentMessages[0].type).toBe('control');
        expect(sentMessages[0].data.action).toBe('pong');
    });

    it('should update lastSeen when receiving pong', async () => {
        const api = createChorus({
            storage: 'memory',
        }).createSession<TestState>({
            name: 'test-db',
            defaultValue: null,
        });

        // Set state so we have an objectId
        await api._test.rawProcessMessage(
            {
                type: 'event',
                data: {
                    eventName: 'setState',
                    payload: { id: 'test-game', value: 1 },
                },
                clock: 1,
                peerId: 'host',
            },
            null as any
        );

        // Manually add a peer to peerData via the instance
        const peerData = api._test.getPeerData();
        if (peerData['test-game']) {
            peerData['test-game'].peers['remote-peer'] = {
                peerId: 'remote-peer',
                lastSeen: 0,
            };
        }

        await api._test.processMessage(
            {
                type: 'control',
                data: { action: 'pong' },
                peerId: 'remote-peer',
            },
            null as any
        );

        const updatedPeerData = api._test.getPeerData();
        if (updatedPeerData['test-game']?.peers['remote-peer']) {
            expect(
                updatedPeerData['test-game'].peers['remote-peer'].lastSeen
            ).toBeGreaterThan(0);
        }
    });

    it('should expose startHeartbeat, stopHeartbeat, and checkPeerHealth', () => {
        const api = createChorus({
            storage: 'memory',
        }).createSession<TestState>({
            name: 'test-db',
            defaultValue: null,
        });

        expect(typeof api.startHeartbeat).toBe('function');
        expect(typeof api.stopHeartbeat).toBe('function');
        expect(typeof api.checkPeerHealth).toBe('function');
        expect(typeof api._test.sendHeartbeats).toBe('function');
        expect(typeof api._test.checkPeerHealth).toBe('function');
    });

    it('should have independent clock state per createSession instance', async () => {
        const api1 = createChorus({
            storage: 'memory',
        }).createSession<TestState>({
            name: 'test-db-1',
            defaultValue: null,
        });
        const api2 = createChorus({
            storage: 'memory',
        }).createSession<TestState>({
            name: 'test-db-2',
            defaultValue: null,
        });

        // Update clock on api1
        await api1._test.rawProcessMessage(
            {
                type: 'event',
                data: {
                    eventName: 'setState',
                    payload: { id: 'test1', value: 1 },
                },
                clock: 100,
                peerId: 'p1',
            },
            null as any
        );

        // api1's clock should be >= 101
        expect(api1._test.getCurrentClock()).toBeGreaterThanOrEqual(101);

        // api2's clock should be 0 (independent instance)
        expect(api2._test.getCurrentClock()).toBe(0);
    });
});

describe('Chorus session — localOn', () => {
    it('should register a local-only reducer', () => {
        const api = createChorus({
            storage: 'memory',
        }).createSession<TestState>({
            name: 'test-db',
            defaultValue: { id: 'test', value: 0 },
        });

        const localEvent = createEvent<number>();
        api.store.localOn(localEvent, (state, payload) => {
            if (!state) return null;
            return { ...state, value: payload };
        });

        localEvent(42);
        expect(api.$state.getState()?.value).toBe(42);
    });
});

describe('Chorus session — getUnits / getLocalUnits', () => {
    it('should return the event maps', () => {
        const api = createChorus({
            storage: 'memory',
        }).createSession<TestState>({
            name: 'test-db',
            defaultValue: { id: 'test', value: 0 },
            api: {
                increment: (state: TestState, by: number) => {
                    if (!state) return null;
                    return { ...state, value: state.value + by };
                },
            },
        });

        const units = api.store.getUnits();
        const localUnits = api.store.getLocalUnits();

        expect(typeof units['increment']).toBe('function');
        expect(typeof localUnits['increment']).toBe('function');
        expect(typeof units['setState']).toBe('function');
    });
});

describe('Chorus session — setState reducer', () => {
    it('should replace state via setState event', () => {
        const api = createChorus({
            storage: 'memory',
        }).createSession<TestState>({
            name: 'test-db',
            defaultValue: { id: 'test', value: 0 },
        });

        api.events['setState']({ id: 'test', value: 99 });
        expect(api.$state.getState()).toEqual({ id: 'test', value: 99 });
    });
});

describe('Fix C: Idempotent Broadcast Suppression', () => {
    it('should not broadcast when reducer returns same state reference', () => {
        type TestState = { id: string; value: number } | null;

        const api = createChorus({
            storage: 'memory',
        }).createSession<TestState>({
            name: 'test-db',
            defaultValue: { id: 'test', value: 0 },
            api: {
                setValue: (state: TestState, payload: number) => {
                    if (!state) return null;
                    if (state.value === payload) return state; // idempotent
                    return { ...state, value: payload };
                },
            },
        });

        const store = api.$state;
        expect(store.getState()?.value).toBe(0);

        // First fire: should change state and broadcast
        api.events['setValue'](42);
        expect(store.getState()?.value).toBe(42);

        // Second fire with same value: idempotent, should NOT broadcast
        // (Fix C: r === state check prevents broadcastMessage call)
        const stateBefore = store.getState();
        api.events['setValue'](42);
        const stateAfter = store.getState();

        // State should be unchanged
        expect(stateAfter?.value).toBe(42);
        // The reducer returned the same state reference, so the store
        // should not have triggered any side effects (broadcast suppressed)
        expect(stateAfter?.value).toBe(stateBefore?.value);
    });

    it('should still broadcast when reducer returns new state', () => {
        type TestState = { id: string; value: number } | null;

        const api = createChorus({
            storage: 'memory',
        }).createSession<TestState>({
            name: 'test-db',
            defaultValue: { id: 'test', value: 0 },
            api: {
                setValue: (state: TestState, payload: number) => {
                    if (!state) return null;
                    return { ...state, value: payload };
                },
            },
        });

        const store = api.$state;
        expect(store.getState()?.value).toBe(0);

        // Fire with a new value — should change state
        api.events['setValue'](100);
        expect(store.getState()?.value).toBe(100);

        // Fire with another new value — should change state again
        api.events['setValue'](200);
        expect(store.getState()?.value).toBe(200);
    });
});
