import Peer, { DataConnection } from 'peerjs';
import { v4 as uuid } from 'uuid';
import {
    createEffect,
    createEvent,
    createStore,
    EventCallable,
    sample,
    StoreWritable,
} from 'effector';
import { useUnit } from 'effector-react';

// -- IndexDB
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

async function put({ storeName, data }: { storeName: string; data: any }) {
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
}

async function get({ storeName, id }: { storeName: string; id: string }) {
    try {
        return await execQuery(storeName, (s: IDBObjectStore) => s.get(id));
    } catch (e) {
        return JSON.parse(sessionStorage.getItem(storeName) ?? '{}')[storeName];
    }
}

// -- WebRTC
interface PeerObjectData {
    objectId: string;
    peerId: string;
    conn?: Peer;
    peers: PeersInfos;
}

interface PeerInfo {
    peerId: string;
    conn?: DataConnection;
}

interface Message {
    type: string;
    data?: any;
}

type PeerData = { [id: string]: PeerObjectData };
type PeersInfos = { [peerId: string]: PeerInfo };

type ProcessMessageType = (
    { type, data }: Message,
    conn: DataConnection
) => Promise<void>;

function savePeerData(data: PeerData) {
    localStorage.setItem('dsstore-peerData', JSON.stringify(data));
}

function getPeerData(): PeerData {
    const str = localStorage.getItem('dsstore-peerData');
    if (!str) {
        savePeerData({});
        return {};
    }
    return JSON.parse(str);
}

export const peerData = getPeerData();

function savePeerObjectData(objectId: string, peerObjectData: PeerObjectData) {
    peerData[objectId] = peerObjectData;

    savePeerData({
        ...peerData,
        [objectId]: {
            peerId: peerObjectData.peerId,
            objectId,
            peers: Object.keys(peerObjectData.peers).reduce((prev, key) => {
                prev[key] = { peerId: peerObjectData.peers[key].peerId };
                return prev;
            }, {} as PeersInfos),
        },
    });
}

async function connectToPeer(
    objetId: string,
    peerId: string,
    processMessage: ProcessMessageType
) {
    const pod = peerData[objetId];
    if (!pod?.conn) return;

    const pi = pod.peers[peerId];
    if (pi?.conn) {
        return pi;
    }

    console.log('[ME] open connection to ', peerId);

    const conn = pod.conn.connect(peerId);
    const peerInfo = { conn, peerId };
    if (!pi) {
        console.log('[ME] save peer info ', peerId);
        pod.peers[peerId] = peerInfo;
        savePeerObjectData(objetId, pod);
    }

    await new Promise((res) => {
        conn.on('data', (mess) => {
            console.log(`[${peerId}] incoming`, mess);
            processMessage(mess as Message, conn);
            res(undefined);
        });

        conn.on('open', () => {
            console.log(`[${peerId}] connection opened`);
        });
    });
}

async function initPeerConnection(
    objectId: string,
    processMessage: ProcessMessageType,
    getState: () => any
): Promise<PeerObjectData> {
    let data = peerData[objectId];

    if (!data) {
        data = {
            objectId,
            peerId: uuid(),
            peers: {},
        };
        savePeerObjectData(objectId, data);
    }

    if (data.conn) {
        return data;
    }

    console.log('init peer connection', data.peerId);
    const peer = new Peer(data.peerId, {
        host: '0.peerjs.com',
        port: 443,
        path: '/',
    });
    data.conn = peer;

    await new Promise((res) => {
        peer.on('open', (id) => {
            console.log('[ME] opened', id);
            res(id);
        });
    });

    peer.on('connection', async (conn) => {
        console.log('[ME] incoming connection', conn);

        data.peers[conn.peer] = { peerId: conn.peer, conn };
        savePeerObjectData(objectId, data);

        await new Promise((res) => {
            conn.on('open', () => {
                console.log('[ME] incoming connection opened to', conn.peer);
                res(undefined);
            });
        });

        conn.on('data', (mess) => {
            console.log(`[ME] receving data from [${conn.peer}]`, mess);
            processMessage(mess as Message, conn);
        });

        console.log('sending message back with state to', conn.peer);
        await conn.send({
            type: 'event',
            data: { eventName: 'setState', payload: getState() },
        });
    });

    for (let key in data.peers) {
        await connectToPeer(objectId, data.peers[key].peerId, processMessage);
    }

    return data;
}

function broadcastMessage({
    objectId,
    message,
}: {
    objectId: string;
    message: Message;
}) {
    const data = peerData[objectId];
    if (!data) return;
    return Promise.allSettled(
        Object.keys(data.peers).map((key) => {
            console.log('broadcasting message to ', key, message);
            return data.peers[key]?.conn?.send(message);
        })
    );
}

// ---

export type StateWithId = { id: string } | null;
export type Reducer<State> = (state: State, payload: any) => State | void;
type Reducers<State> = { [key: string]: Reducer<State> };

class DSStore<State extends StateWithId> {
    private $store;
    private units: { [key: string]: EventCallable<any> };
    private localUnits: { [key: string]: EventCallable<any> };

    constructor($store: StoreWritable<State>, api?: Reducers<State>) {
        this.$store = $store;
        this.units = {};
        this.localUnits = {};
        Object.keys(api ?? {}).forEach((event) => {
            if (!api?.[event]) return;
            this.on(event, createEvent(), api[event]);
        });

        this.on('setState', createEvent(), (_, state) => state);
    }

    getUnits() {
        return this.units;
    }

    getLocalUnits() {
        return this.localUnits;
    }

    /**
     * Local reducer binding doesn't trigger sync with other peers
     */
    localOn<E>(
        trigger: EventCallable<E>,
        reducer: (state: State, payload: E) => State | void
    ): this {
        this.$store.on(trigger, reducer);
        return this;
    }

    on<E>(
        name: string,
        trigger: EventCallable<E>,
        reducer: (state: State, payload: E) => State | void
    ): this {
        this.units[name] = trigger;

        const localEvent = createEvent<E>(); // different event required to avoid circular calls
        this.localUnits[name] = localEvent;
        //console.log('binding event', name);

        this.$store
            .on(trigger, (state, payload) => {
                const id = state?.id ?? (payload as any)?.id;
                console.log('trigger update', name, id, payload);
                if (!id) return state;
                const r = reducer(state, payload);
                console.log('reducer result for', name, r);
                if (r) {
                    broadcastMessage({
                        objectId: id,
                        message: {
                            type: 'event',
                            data: {
                                eventName: name,
                                payload,
                            },
                        },
                    });
                }
                return r;
            })
            .on(localEvent, (state, payload) => {
                const id = state?.id ?? (payload as any)?.id;
                console.log('local event', name, 'calling reducer with id', id);
                if (!id) return state;
                return reducer(state, payload);
            });

        return this;
    }
}

export function createDSApi<State extends StateWithId>({
    dbStoreName,
    defaultValue,
    api,
}: {
    dbStoreName: string;
    defaultValue: State;
    api?: Reducers<State>;
}) {
    const $store = createStore<State>(defaultValue);
    const $peerId = createStore<string | null>(null);

    const dsStore = new DSStore<State>($store, api);
    const initObject = createEvent<string>();
    const setPeerId = createEvent<string>();
    const events = dsStore.getUnits();
    const localEvents = dsStore.getLocalUnits();

    const processMessage = async (
        { type, data }: Message,
        conn: DataConnection
    ) => {
        if (type === 'event' && data.eventName) {
            localEvents[data.eventName]?.(data.payload);
        }
    };

    const loadFromStorageFx = createEffect(
        async (objectId: string) =>
            (await get({ storeName: dbStoreName, id: objectId })) ?? null
    );

    $store.on(loadFromStorageFx.doneData, (_, state) => state);
    $peerId.on(setPeerId, (_, state) => state);

    const getState = () => $store.getState();

    sample({
        source: $store,
        target: createEffect(async (object: State | null) => {
            if (!object) return;
            await put({
                storeName: dbStoreName,
                data: {
                    ...object,
                    updatedAt: new Date(),
                },
            });
        }),
    });

    sample({
        clock: initObject,
        target: createEffect(async (id: string) => {
            await loadFromStorageFx(id);
            const peerObjectData = await initPeerConnection(
                id,
                processMessage,
                getState
            );
            setPeerId(peerObjectData.peerId);
            console.log(
                'object reloaded from storage, peerid = ',
                peerObjectData.peerId
            );
        }),
    });

    const joinFx = createEffect(
        async ({ objectId, peerId }: { objectId: string; peerId: string }) => {
            const obj = await loadFromStorageFx(objectId);
            if (obj) {
                console.log('OBJECT ALREADY EXISTING');
                return;
            }

            console.log('joining object of peer ', objectId, peerId);
            await initPeerConnection(objectId, processMessage, getState);
            await connectToPeer(objectId, peerId, processMessage);
            console.log('joined');
            return objectId;
        }
    );

    return {
        store: dsStore,
        init: initObject,
        $store,
        $peerId,
        useStore: () => useUnit($store),
        usePeerId: () => useUnit($peerId),
        joinFx,
        events,
    };
}
