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
import {
    appendToEventLog,
    getEventsSinceClock,
    getLatestClock,
    EventLogEntry,
} from './eventLog';

const DEBUG = false;

const isDebug = () => DEBUG;

// -- Lamport Clock for event ordering
let lamportClock = 0;

/** Exported for testing purposes only */
export function getCurrentClock(): number {
    return lamportClock;
}

const eventBuffer: {
    message: Message;
    conn: DataConnection;
}[] = [];
let flushTimeoutId: ReturnType<typeof setTimeout> | null = null;
let lastAppliedClock = 0;

function getNextClock(): number {
    return ++lamportClock;
}

function updateClock(receivedClock: number): void {
    lamportClock = Math.max(lamportClock, receivedClock) + 1;
}

function tryFlushBuffer(processMessage: ProcessMessageType): void {
    // Sort by (clock, peerId) for deterministic ordering
    eventBuffer.sort((a, b) => {
        if (a.message.clock !== b.message.clock) {
            return (a.message.clock ?? 0) - (b.message.clock ?? 0);
        }
        return (a.message.peerId ?? '').localeCompare(b.message.peerId ?? '');
    });

    // Find the contiguous sequence starting from lastAppliedClock + 1
    const toApply: typeof eventBuffer = [];
    const remaining: typeof eventBuffer = [];
    let currentClock = lastAppliedClock;

    for (const entry of eventBuffer) {
        if ((entry.message.clock ?? 0) === currentClock + 1) {
            toApply.push(entry);
            currentClock = entry.message.clock ?? 0;
        } else {
            remaining.push(entry);
        }
    }

    eventBuffer.length = 0;
    eventBuffer.push(...remaining);

    // Apply in order
    for (const { message, conn } of toApply) {
        lastAppliedClock = message.clock ?? 0;
        processMessage(message, conn);
    }

    // If there's a gap, schedule a flush attempt after a short delay
    if (eventBuffer.length > 0 && !flushTimeoutId) {
        flushTimeoutId = setTimeout(() => {
            flushTimeoutId = null;
            // Force apply all buffered events in sorted order
            eventBuffer.sort((a, b) => {
                if (a.message.clock !== b.message.clock) {
                    return (a.message.clock ?? 0) - (b.message.clock ?? 0);
                }
                return (a.message.peerId ?? '').localeCompare(
                    b.message.peerId ?? ''
                );
            });
            for (const { message, conn } of eventBuffer) {
                lastAppliedClock = message.clock ?? 0;
                processMessage(message, conn);
            }
            eventBuffer.length = 0;
        }, 500);
    }
}

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
    clock?: number;
    peerId?: string;
    checksum?: string;
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
): Promise<DataConnection | undefined> {
    const pod = peerData[objetId];
    if (!pod?.conn) return;

    const pi = pod.peers[peerId];
    if (pi?.conn) {
        return pi.conn;
    }

    isDebug() && console.log('[ME] open connection to ', peerId);

    const conn = pod.conn.connect(peerId);
    const peerInfo = { conn, peerId };
    pod.peers[peerId] = peerInfo;

    if (!pi) {
        isDebug() && console.log('[ME] save peer info ', peerId);
        savePeerObjectData(objetId, pod);
    }

    await new Promise((res) => {
        conn.on('error', () => {
            isDebug() && console.log(`[${peerId}] ERROR`);
        });

        conn.on('iceStateChanged', (e) => {
            isDebug() && console.log(`[${peerId}] iceStateChanged`, e);
        });

        conn.on('data', (mess) => {
            isDebug() && console.log(`[${peerId}] incoming`, mess);
            processMessage(mess as Message, conn);
            res(undefined);
        });

        conn.on('open', () => {
            isDebug() && console.log(`[${peerId}] connection opened`);
        });
    });

    return conn;
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

    isDebug() && console.log('init peer connection', data.peerId);
    const peer = new Peer(data.peerId, {
        host: '0.peerjs.com',
        port: 443,
        path: '/',
    });
    data.conn = peer;

    await new Promise((res) => {
        peer.on('open', (id) => {
            isDebug() && console.log('[ME] opened', id);
            res(id);
        });
    });

    peer.on('connection', async (conn) => {
        isDebug() && console.log('[ME] incoming connection', conn);

        data.peers[conn.peer] = { peerId: conn.peer, conn };
        savePeerObjectData(objectId, data);

        await new Promise((res) => {
            conn.on('error', () => {
                isDebug() && console.log(`[ME] ERROR`);
            });

            conn.on('iceStateChanged', (e) => {
                isDebug() && console.log(`[ME] iceStateChanged`, e);
            });

            conn.on('data', (mess) => {
                isDebug() &&
                    console.log(`[ME] receving data from [${conn.peer}]`, mess);
                processMessage(mess as Message, conn);
            });

            conn.on('open', () => {
                isDebug() &&
                    console.log(
                        '[ME] incoming connection opened to',
                        conn.peer
                    );
                res(undefined);
            });
        });

        isDebug() &&
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
    getState,
    computeChecksum,
}: {
    objectId: string;
    message: Message;
    getState?: () => any;
    computeChecksum?: (state: any) => string;
}) {
    const data = peerData[objectId];
    if (!data) return;
    isDebug() && console.log('peers', Object.keys(data.peers));

    // Stamp with Lamport clock before broadcasting
    const clock = getNextClock();
    const stamped: Message = {
        ...message,
        clock,
        peerId: data.peerId,
    };

    // Attach checksum if a computeChecksum function was provided
    if (computeChecksum && getState) {
        stamped.checksum = computeChecksum(getState());
    }

    return Promise.allSettled(
        Object.keys(data.peers).map((key) => {
            isDebug() && console.log('broadcasting message to ', key, stamped);
            if (!data.peers[key].conn) {
                console.log('ERROR no connection for ', key);
                return;
            }
            return data.peers[key].conn.send(stamped);
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
    private getState: () => State;
    private computeChecksum?: (state: State) => string;

    constructor(
        $store: StoreWritable<State>,
        getState: () => State,
        api?: Reducers<State>,
        computeChecksum?: (state: State) => string
    ) {
        this.$store = $store;
        this.getState = getState;
        this.computeChecksum = computeChecksum;
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

        this.$store
            .on(trigger, (state, payload) => {
                const id = state?.id ?? (payload as any)?.id;
                isDebug() && console.log('trigger update', name, id, payload);
                if (!id) return state;
                const r = reducer(state, payload);
                isDebug() && console.log('reducer result for', name, r);
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
                        getState: this.getState,
                        computeChecksum: this.computeChecksum,
                    });
                }
                return r;
            })
            .on(localEvent, (state, payload) => {
                const id = state?.id ?? (payload as any)?.id;
                isDebug() &&
                    console.log(
                        'local event',
                        name,
                        'calling reducer with id',
                        id
                    );
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
    computeChecksum,
}: {
    dbStoreName: string;
    defaultValue: State;
    api?: Reducers<State>;
    computeChecksum?: (state: State) => string;
}) {
    const $store = createStore<State>(defaultValue);
    const $peerId = createStore<string | null>(null);

    const getState = () => $store.getState();
    const dsStore = new DSStore<State>($store, getState, api, computeChecksum);
    const initObject = createEvent<string>();
    const setPeerId = createEvent<string>();
    const events = dsStore.getUnits();
    const localEvents = dsStore.getLocalUnits();

    // Wrapped processMessage: buffers and reorders messages by Lamport clock
    const rawProcessMessage = async (
        { type, data, checksum, clock, peerId }: Message,
        conn: DataConnection
    ) => {
        if (type === 'event' && data.eventName) {
            // Update Lamport clock from the message clock (even for setState)
            if (clock !== undefined) {
                updateClock(clock);
            }

            localEvents[data.eventName]?.(data.payload);

            // Log event to append-only event log for reconnection support
            if (
                data.eventName !== 'setState' &&
                clock !== undefined &&
                peerId
            ) {
                appendToEventLog({
                    id: `${peerId}-${clock}-${Date.now()}`,
                    clock,
                    peerId,
                    eventName: data.eventName,
                    payload: data.payload,
                    stateChecksum: checksum,
                    timestamp: Date.now(),
                }).catch(() => {});
            }

            // Verify checksum after applying the event (if checksums are enabled)
            if (checksum !== undefined && computeChecksum) {
                const localChecksum = computeChecksum(getState());
                if (localChecksum !== checksum) {
                    console.warn(
                        `[DIVERGENCE] Event "${data.eventName}" caused state divergence. ` +
                            `Expected checksum: ${checksum}, local: ${localChecksum}`
                    );
                }
            }
        }
    };

    const processMessage = async (message: Message, conn: DataConnection) => {
        // Handle control messages directly (not through Lamport clock buffer)
        if (message.type === 'control') {
            const { data } = message;
            if (data?.action === 'requestState') {
                // Respond with current state + latest clock
                const state = getState();
                const latestClock = await getLatestClock();
                conn.send({
                    type: 'event',
                    data: {
                        eventName: 'setState',
                        payload: state,
                        latestClock,
                    },
                });
                return;
            }
            if (data?.action === 'catchUpRequest') {
                // Reconnecting peer wants events since their last known clock
                const events = await getEventsSinceClock(data.sinceClock ?? 0);
                conn.send({
                    type: 'control',
                    data: {
                        action: 'catchUpResponse',
                        events,
                    },
                });
                return;
            }
            if (data?.action === 'catchUpResponse') {
                // Apply missed events in order and update clock
                const missedEvents: EventLogEntry[] = data.events ?? [];
                let maxClock = 0;
                for (const entry of missedEvents) {
                    if (entry.clock > maxClock) maxClock = entry.clock;
                    localEvents[entry.eventName]?.(entry.payload);
                }
                // Sync our Lamport clock to at least the max clock from replayed events
                if (maxClock > 0) {
                    lamportClock = Math.max(lamportClock, maxClock);
                }
                return;
            }
            return;
        }

        // Update our clock from incoming message
        if (message.clock !== undefined) {
            updateClock(message.clock);
        }

        // Buffer and attempt to flush in order
        eventBuffer.push({ message, conn });
        tryFlushBuffer(rawProcessMessage);
    };

    const loadFromStorageFx = createEffect(
        async (objectId: string) =>
            (await get({ storeName: dbStoreName, id: objectId })) ?? null
    );

    $store.on(loadFromStorageFx.doneData, (_, state) => state);
    $peerId.on(setPeerId, (_, state) => state);

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
            isDebug() &&
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
                isDebug() && console.log('OBJECT ALREADY EXISTING');
                return objectId;
            }

            isDebug() &&
                console.log('joining object of peer ', objectId, peerId);
            await initPeerConnection(objectId, processMessage, getState);
            const conn = await connectToPeer(objectId, peerId, processMessage);

            // Send a requestState control message as fallback in case
            // the initial setState from initPeerConnection was dropped
            conn?.send({
                type: 'control',
                data: { action: 'requestState' },
            });

            isDebug() && console.log('joined');
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
        /** @internal Exposed for testing only */
        _test: {
            processMessage,
            rawProcessMessage,
        },
    };
}
