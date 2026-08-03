import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStorage } from '../core/storage';

beforeEach(() => {
    // Stub localStorage
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

    // Stub sessionStorage
    const session: Record<string, string> = {};
    vi.stubGlobal('sessionStorage', {
        getItem: (key: string) => session[key] ?? null,
        setItem: (key: string, value: string) => {
            session[key] = value;
        },
        removeItem: (key: string) => {
            delete session[key];
        },
        clear: () => {
            Object.keys(session).forEach((k) => delete session[k]);
        },
    });
});

describe('Chorus storage — memory adapter', () => {
    it('should put and get a value', async () => {
        const storage = createStorage('memory');
        await storage.put({ storeName: 'test', data: { id: 'a', value: 1 } });
        const result = await storage.get({ storeName: 'test', id: 'a' });
        expect(result).toEqual({ id: 'a', value: 1 });
    });

    it('should return null for missing key', async () => {
        const storage = createStorage('memory');
        const result = await storage.get({ storeName: 'test', id: 'missing' });
        expect(result).toBeNull();
    });

    it('should overwrite existing key', async () => {
        const storage = createStorage('memory');
        await storage.put({ storeName: 'test', data: { id: 'a', value: 1 } });
        await storage.put({ storeName: 'test', data: { id: 'a', value: 2 } });
        const result = await storage.get({ storeName: 'test', id: 'a' });
        expect(result).toEqual({ id: 'a', value: 2 });
    });

    it('should isolate different store names', async () => {
        const storage = createStorage('memory');
        await storage.put({ storeName: 'one', data: { id: 'a', value: 1 } });
        const result = await storage.get({ storeName: 'two', id: 'a' });
        expect(result).toBeNull();
    });
});

describe('Chorus storage — localStorage adapter', () => {
    it('should put and get a value', async () => {
        const storage = createStorage('localstorage');
        await storage.put({ storeName: 'test', data: { id: 'a', value: 1 } });
        const result = await storage.get({ storeName: 'test', id: 'a' });
        expect(result).toEqual({ id: 'a', value: 1 });
    });

    it('should return null for missing key', async () => {
        const storage = createStorage('localstorage');
        const result = await storage.get({ storeName: 'test', id: 'missing' });
        expect(result).toBeNull();
    });

    it('should persist across storage instances', async () => {
        const storage1 = createStorage('localstorage');
        await storage1.put({ storeName: 'test', data: { id: 'a', value: 1 } });

        const storage2 = createStorage('localstorage');
        const result = await storage2.get({ storeName: 'test', id: 'a' });
        expect(result).toEqual({ id: 'a', value: 1 });
    });
});

describe('Chorus storage — indexeddb adapter fallback', () => {
    it('should fall back to sessionStorage when IndexedDB is unavailable', async () => {
        // Make indexedDB throw
        vi.stubGlobal('indexedDB', undefined);

        const storage = createStorage('indexeddb');
        await storage.put({ storeName: 'test', data: { id: 'a', value: 1 } });
        const result = await storage.get({ storeName: 'test', id: 'a' });
        expect(result).toEqual({ id: 'a', value: 1 });
    });
});
