import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    appendToEventLog,
    getEventsSinceClock,
    getLatestClock,
    clearEventLog,
} from '../debug/eventLog';

beforeEach(() => {
    // No IndexedDB in node environment — eventLog should gracefully fail
    vi.stubGlobal('indexedDB', undefined);
});

describe('Chorus eventLog — graceful failure without IndexedDB', () => {
    it('should return empty array from getEventsSinceClock', async () => {
        const events = await getEventsSinceClock(0);
        expect(events).toEqual([]);
    });

    it('should return 0 from getLatestClock', async () => {
        const latest = await getLatestClock();
        expect(latest).toBe(0);
    });

    it('should not throw on appendToEventLog', async () => {
        await expect(
            appendToEventLog({
                id: 'evt-1',
                clock: 1,
                peerId: 'p1',
                eventName: 'selectCard',
                payload: {},
                timestamp: Date.now(),
            })
        ).resolves.toBeUndefined();
    });

    it('should not throw on clearEventLog', async () => {
        await expect(clearEventLog()).resolves.toBeUndefined();
    });
});
