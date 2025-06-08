const openDb = (): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
        const request = indexedDB.open('syos', 1);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains('games')) {
                db.createObjectStore('games', {
                    keyPath: 'id',
                    autoIncrement: false,
                });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

const execQuery = async (
    storeName: string,
    getRequest: (s: IDBObjectStore) => IDBRequest,
    action: 'readonly' | 'readwrite' = 'readonly'
): Promise<any> => {
    const db = await openDb();
    const transaction = db.transaction(storeName, action);
    const store = transaction.objectStore(storeName);
    const res = await new Promise((resolve, reject) => {
        const req = getRequest(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    return res;
};

export const getAll = ({ storeName }: { storeName: string }) => {
    try {
        execQuery(storeName, (s: IDBObjectStore) => s.getAll());
    } catch (e) {
        return JSON.parse(sessionStorage.getItem(storeName) ?? '{}');
    }
};

export const put = async ({
    storeName,
    data,
}: {
    storeName: string;
    data: any;
}) => {
    try {
        await execQuery(
            storeName,
            (s: IDBObjectStore) => s.put(data),
            'readwrite'
        );
    } catch (e) {
        const obj = JSON.parse(sessionStorage.getItem(storeName) ?? '{}');
        obj[data.id] = data;
        sessionStorage.setItem(storeName, obj);
    }
};

export const get = async ({
    storeName,
    id,
}: {
    storeName: string;
    id: string;
}) => {
    try {
        return await execQuery(storeName, (s: IDBObjectStore) => s.get(id));
    } catch (e) {
        return JSON.parse(sessionStorage.getItem(storeName) ?? '{}')[storeName];
    }
};
