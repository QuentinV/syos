/**
 * Append-only event log stored in IndexedDB.
 * Enables reconnecting peers to replay missed events.
 */

const DB_NAME = 'ds-event-log';
const DB_VERSION = 1;
const STORE_NAME = 'events';

export interface EventLogEntry {
    id: string;
    clock: number;
    peerId: string;
    eventName: string;
    payload: any;
    stateChecksum?: string;
    timestamp: number;
}

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, {
                    keyPath: 'id',
                    autoIncrement: false,
                });
                store.createIndex('clock', 'clock', { unique: false });
                store.createIndex('peerId', 'peerId', { unique: false });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Append an event to the log.
 */
export async function appendToEventLog(entry: EventLogEntry): Promise<void> {
    try {
        const db = await openDb();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        await new Promise<void>((resolve, reject) => {
            const req = store.put(entry);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        // Silently fail — event log is non-critical
        console.warn('[EventLog] Failed to append event:', e);
    }
}

/**
 * Get all events with clock > sinceClock, ordered by (clock, peerId).
 */
export async function getEventsSinceClock(
    sinceClock: number,
    limit = 500
): Promise<EventLogEntry[]> {
    try {
        const db = await openDb();
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('clock');

        const range = IDBKeyRange.lowerBound(sinceClock + 1, true);
        const entries: EventLogEntry[] = [];

        await new Promise<void>((resolve, reject) => {
            const req = index.openCursor(range);
            req.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>)
                    .result;
                if (cursor && entries.length < limit) {
                    entries.push(cursor.value as EventLogEntry);
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            req.onerror = () => reject(req.error);
        });

        // Sort by (clock, peerId) for deterministic ordering
        entries.sort((a, b) => {
            if (a.clock !== b.clock) return a.clock - b.clock;
            return a.peerId.localeCompare(b.peerId);
        });

        return entries;
    } catch (e) {
        console.warn('[EventLog] Failed to read events:', e);
        return [];
    }
}

/**
 * Get the highest clock value in the log.
 */
export async function getLatestClock(): Promise<number> {
    try {
        const db = await openDb();
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('clock');

        return await new Promise<number>((resolve, reject) => {
            const req = index.openCursor(null, 'prev');
            req.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>)
                    .result;
                if (cursor) {
                    resolve((cursor.value as EventLogEntry).clock);
                } else {
                    resolve(0);
                }
            };
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        return 0;
    }
}

/**
 * Clear all events from the log (for testing or game reset).
 */
export async function clearEventLog(): Promise<void> {
    try {
        const db = await openDb();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        await new Promise<void>((resolve, reject) => {
            const req = store.clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        console.warn('[EventLog] Failed to clear:', e);
    }
}
