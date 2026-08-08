import { StorageAdapter } from './types';

// -- IndexedDB (stateless helpers, safe to keep module-level)
function openDb(storename: string): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('ds', 1);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(storename)) {
                db.createObjectStore(storename, {
                    keyPath: 'id',
                    autoIncrement: false,
                });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function execQuery(
    storeName: string,
    getRequest: (s: IDBObjectStore) => IDBRequest,
    action: 'readonly' | 'readwrite' = 'readonly'
): Promise<any> {
    const db = await openDb(storeName);
    const transaction = db.transaction(storeName, action);
    const store = transaction.objectStore(storeName);
    const res = await new Promise((resolve, reject) => {
        const req = getRequest(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    return res;
}

async function putIndexedDb({
    storeName,
    data,
}: {
    storeName: string;
    data: any;
}) {
    try {
        await execQuery(
            storeName,
            (s: IDBObjectStore) => s.put(data),
            'readwrite'
        );
    } catch (e) {
        const obj = JSON.parse(sessionStorage.getItem(storeName) ?? '{}');
        obj[data.id] = data;
        sessionStorage.setItem(storeName, JSON.stringify(obj));
    }
}

async function getIndexedDb({
    storeName,
    id,
}: {
    storeName: string;
    id: string;
}) {
    try {
        return await execQuery(storeName, (s: IDBObjectStore) => s.get(id));
    } catch (e) {
        return (
            JSON.parse(sessionStorage.getItem(storeName) ?? '{}')[id] ?? null
        );
    }
}

// -- Memory adapter (for tests and non-browser environments)
const memoryStore = new Map<string, Map<string, any>>();

async function putMemory({
    storeName,
    data,
}: {
    storeName: string;
    data: any;
}) {
    if (!memoryStore.has(storeName)) {
        memoryStore.set(storeName, new Map());
    }
    memoryStore.get(storeName)!.set(data.id, data);
}

async function getMemory({ storeName, id }: { storeName: string; id: string }) {
    return memoryStore.get(storeName)?.get(id) ?? null;
}

// -- localStorage adapter
async function putLocalStorage({
    storeName,
    data,
}: {
    storeName: string;
    data: any;
}) {
    const obj = JSON.parse(localStorage.getItem(storeName) ?? '{}');
    obj[data.id] = data;
    localStorage.setItem(storeName, JSON.stringify(obj));
}

async function getLocalStorage({
    storeName,
    id,
}: {
    storeName: string;
    id: string;
}) {
    const obj = JSON.parse(localStorage.getItem(storeName) ?? '{}');
    return obj[id] ?? null;
}

// -- Public storage API
export interface Storage {
    put(args: { storeName: string; data: any }): Promise<void>;
    get(args: { storeName: string; id: string }): Promise<any>;
}

export function createStorage(adapter: StorageAdapter = 'indexeddb'): Storage {
    switch (adapter) {
        case 'memory':
            return {
                put: putMemory,
                get: getMemory,
            };
        case 'localstorage':
            return {
                put: putLocalStorage,
                get: getLocalStorage,
            };
        case 'indexeddb':
        default:
            return {
                put: putIndexedDb,
                get: getIndexedDb,
            };
    }
}
