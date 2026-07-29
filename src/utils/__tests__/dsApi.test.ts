import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use dynamic import to ensure localStorage is stubbed before module code runs
let createDSApi: any;
let getCurrentClock: any;

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
    const mod = await import('../dsApi');
    createDSApi = mod.createDSApi;
    getCurrentClock = mod.getCurrentClock;
});

/**
 * Real integration tests for dsApi.ts.
 * These tests exercise the actual createDSApi implementation,
 * not the MockPeer. They verify that the Lamport clock is
 * correctly updated by rawProcessMessage and processMessage.
 */

type TestState = { id: string; value: number } | null;

describe('dsApi.ts — Lamport clock integration', () => {
    it('should update lamportClock when rawProcessMessage receives a setState event', async () => {
        const api = createDSApi<TestState>({
            dbStoreName: 'test-db',
            defaultValue: null,
        });

        const clockBefore = getCurrentClock();

        // Simulate receiving a setState event through rawProcessMessage
        // This is the real code path that was previously missing clock updates
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
            null as any // DataConnection not needed for this test
        );

        const clockAfter = getCurrentClock();

        // rawProcessMessage calls updateClock(5) which does Math.max(0, 5) + 1 = 6
        expect(clockAfter).toBeGreaterThanOrEqual(6);
        expect(clockAfter).toBeGreaterThan(clockBefore);
    });

    it('should update lamportClock when rawProcessMessage receives a regular event', async () => {
        const api = createDSApi<TestState>({
            dbStoreName: 'test-db',
            defaultValue: null,
        });

        const clockBefore = getCurrentClock();

        // Simulate receiving a regular event through rawProcessMessage
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

        const clockAfter = getCurrentClock();

        // updateClock(10) does Math.max(0, 10) + 1 = 11
        expect(clockAfter).toBeGreaterThanOrEqual(11);
    });

    it('should update lamportClock when processMessage receives a regular event through the buffer', async () => {
        const api = createDSApi<TestState>({
            dbStoreName: 'test-db',
            defaultValue: null,
        });

        const clockBefore = getCurrentClock();

        // Simulate receiving a message through processMessage (the full path)
        // This goes through the Lamport clock buffer
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

        const clockAfter = getCurrentClock();

        // processMessage calls updateClock(7) which does Math.max(0, 7) + 1 = 8
        // then buffers and flushes through rawProcessMessage which calls updateClock again
        // So clock should be >= 8
        expect(clockAfter).toBeGreaterThanOrEqual(8);
    });

    it('should update lamportClock from catchUpResponse with replayed events', async () => {
        const api = createDSApi<TestState>({
            dbStoreName: 'test-db',
            defaultValue: null,
        });

        const clockBefore = getCurrentClock();

        // Simulate receiving a catchUpResponse control message with replayed events
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

        const clockAfter = getCurrentClock();

        // catchUpResponse handler computes maxClock = 20, then sets
        // lamportClock = Math.max(lamportClock, 20) = 20
        expect(clockAfter).toBeGreaterThanOrEqual(20);
        expect(clockAfter).toBeGreaterThan(clockBefore);
    });

    it('should handle multiple events and keep clock monotonic', async () => {
        const api = createDSApi<TestState>({
            dbStoreName: 'test-db',
            defaultValue: null,
        });

        // Send a series of events with increasing clocks
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
        const clock1 = getCurrentClock();

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
        const clock2 = getCurrentClock();

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
        const clock3 = getCurrentClock();

        // Clock should be strictly increasing
        expect(clock2).toBeGreaterThan(clock1);
        expect(clock3).toBeGreaterThan(clock2);

        // Each call to updateClock does Math.max + 1
        // clock1: Math.max(0, 1) + 1 = 2
        // clock2: Math.max(2, 5) + 1 = 6
        // clock3: Math.max(6, 10) + 1 = 11
        expect(clock1).toBeGreaterThanOrEqual(2);
        expect(clock2).toBeGreaterThanOrEqual(6);
        expect(clock3).toBeGreaterThanOrEqual(11);
    });

    it('should handle catchUpResponse with empty events list', async () => {
        const api = createDSApi<TestState>({
            dbStoreName: 'test-db',
            defaultValue: null,
        });

        const clockBefore = getCurrentClock();

        // Empty events list should not change the clock
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

        const clockAfter = getCurrentClock();
        expect(clockAfter).toBe(clockBefore);
    });
});
