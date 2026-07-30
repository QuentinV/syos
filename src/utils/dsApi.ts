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

// -- Types
interface PeerObjectData {
    objectId: string;
    peerId: string;
    conn?: Peer;
    peers: PeersInfos;
}

interface PeerInfo {
    peerId: string;
    conn?: DataConnection;
    lastSeen: number;
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

// -- DSConnection: encapsulates all P2P state per createDSApi() instance
class DSConnection {
    private lamportClock = 0;
    private eventBuffer: {
        message: Message;
        conn: DataConnection;
    }[] = [];
    private flushTimeoutId: ReturnType<typeof setTimeout> | null = null;
    private lastAppliedClock = 0;
    private peerData: PeerData;

    // Heartbeat
    private heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;
    private healthCheckIntervalId: ReturnType<typeof setInterval> | null = null;
    private readonly HEARTBEAT_INTERVAL = 5000;
    private readonly PEER_TIMEOUT = 15000;

    constructor() {
        this.peerData = this.loadPeerData();
    }

    // -- Peer data persistence
    private savePeerData(data: PeerData) {
        localStorage.setItem('dsstore-peerData', JSON.stringify(data));
    }

    private loadPeerData(): PeerData {
        const str = localStorage.getItem('dsstore-peerData');
        if (!str) {
            this.savePeerData({});
            return {};
        }
        return JSON.parse(str);
    }

    getPeerData(): PeerData {
        return this.peerData;
    }

    private savePeerObjectData(
        objectId: string,
        peerObjectData: PeerObjectData
    ) {
        this.peerData[objectId] = peerObjectData;

        this.savePeerData({
            ...this.peerData,
            [objectId]: {
                peerId: peerObjectData.peerId,
                objectId,
                peers: Object.keys(peerObjectData.peers).reduce((prev, key) => {
                    prev[key] = {
                        peerId: peerObjectData.peers[key].peerId,
                        lastSeen:
                            peerObjectData.peers[key].lastSeen ?? Date.now(),
                    };
                    return prev;
                }, {} as PeersInfos),
            },
        });
    }

    // -- Lamport clock
    getCurrentClock(): number {
        return this.lamportClock;
    }

    private getNextClock(): number {
        return ++this.lamportClock;
    }

    updateClock(receivedClock: number): void {
        this.lamportClock = Math.max(this.lamportClock, receivedClock) + 1;
    }

    setClock(value: number): void {
        this.lamportClock = Math.max(this.lamportClock, value);
    }

    // -- Event buffer
    tryFlushBuffer(processMessage: ProcessMessageType): void {
        this.eventBuffer.sort((a, b) => {
            if (a.message.clock !== b.message.clock) {
                return (a.message.clock ?? 0) - (b.message.clock ?? 0);
            }
            return (a.message.peerId ?? '').localeCompare(
                b.message.peerId ?? ''
            );
        });

        const toApply: typeof this.eventBuffer = [];
        const remaining: typeof this.eventBuffer = [];
        let currentClock = this.lastAppliedClock;

        for (const entry of this.eventBuffer) {
            if ((entry.message.clock ?? 0) === currentClock + 1) {
                toApply.push(entry);
                currentClock = entry.message.clock ?? 0;
            } else {
                remaining.push(entry);
            }
        }

        this.eventBuffer.length = 0;
        this.eventBuffer.push(...remaining);

        for (const { message, conn } of toApply) {
            this.lastAppliedClock = message.clock ?? 0;
            processMessage(message, conn);
        }

        if (this.eventBuffer.length > 0 && !this.flushTimeoutId) {
            this.flushTimeoutId = setTimeout(() => {
                this.flushTimeoutId = null;
                this.eventBuffer.sort((a, b) => {
                    if (a.message.clock !== b.message.clock) {
                        return (a.message.clock ?? 0) - (b.message.clock ?? 0);
                    }
                    return (a.message.peerId ?? '').localeCompare(
                        b.message.peerId ?? ''
                    );
                });
                for (const { message, conn } of this.eventBuffer) {
                    this.lastAppliedClock = message.clock ?? 0;
                    processMessage(message, conn);
                }
                this.eventBuffer.length = 0;
            }, 500);
        }
    }

    bufferMessage(message: Message, conn: DataConnection) {
        this.eventBuffer.push({ message, conn });
    }

    // -- WebRTC connection management
    async connectToPeer(
        objetId: string,
        peerId: string,
        processMessage: ProcessMessageType
    ): Promise<DataConnection | undefined> {
        const pod = this.peerData[objetId];
        if (!pod?.conn) return;

        const pi = pod.peers[peerId];
        if (pi?.conn) {
            return pi.conn;
        }

        isDebug() && console.log('[ME] open connection to ', peerId);

        const conn = pod.conn.connect(peerId);
        const peerInfo: PeerInfo = { conn, peerId, lastSeen: Date.now() };
        pod.peers[peerId] = peerInfo;

        if (!pi) {
            isDebug() && console.log('[ME] save peer info ', peerId);
            this.savePeerObjectData(objetId, pod);
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

    async initPeerConnection(
        objectId: string,
        processMessage: ProcessMessageType,
        getState: () => any
    ): Promise<PeerObjectData> {
        let data = this.peerData[objectId];

        if (!data) {
            data = {
                objectId,
                peerId: uuid(),
                peers: {},
            };
            this.savePeerObjectData(objectId, data);
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

            data.peers[conn.peer] = {
                peerId: conn.peer,
                conn,
                lastSeen: Date.now(),
            };
            this.savePeerObjectData(objectId, data);

            await new Promise((res) => {
                conn.on('error', () => {
                    isDebug() && console.log(`[ME] ERROR`);
                });

                conn.on('iceStateChanged', (e) => {
                    isDebug() && console.log(`[ME] iceStateChanged`, e);
                });

                conn.on('data', (mess) => {
                    isDebug() &&
                        console.log(
                            `[ME] receving data from [${conn.peer}]`,
                            mess
                        );
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
            await this.connectToPeer(
                objectId,
                data.peers[key].peerId,
                processMessage
            );
        }

        return data;
    }

    broadcastMessage({
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
        const data = this.peerData[objectId];
        if (!data) return;
        isDebug() && console.log('peers', Object.keys(data.peers));

        const clock = this.getNextClock();
        const stamped: Message = {
            ...message,
            clock,
            peerId: data.peerId,
        };

        if (computeChecksum && getState) {
            stamped.checksum = computeChecksum(getState());
        }

        return Promise.allSettled(
            Object.keys(data.peers).map((key) => {
                isDebug() &&
                    console.log('broadcasting message to ', key, stamped);
                if (!data.peers[key].conn) {
                    console.log('ERROR no connection for ', key);
                    return;
                }
                return data.peers[key].conn.send(stamped);
            })
        );
    }

    // -- Heartbeat / Connection Health Monitoring
    sendHeartbeats(getState: () => any): void {
        const state = getState();
        if (!state?.id) return;
        const pod = this.peerData[state.id];
        if (!pod) return;

        Object.keys(pod.peers).forEach((peerId) => {
            const peerInfo = pod.peers[peerId];
            if (peerInfo?.conn) {
                peerInfo.conn.send({
                    type: 'control',
                    data: { action: 'ping' },
                    peerId: pod.peerId,
                });
            }
        });
    }

    checkPeerHealth(getState: () => any): string[] {
        const state = getState();
        if (!state?.id) return [];
        const pod = this.peerData[state.id];
        if (!pod) return [];

        const now = Date.now();
        const disconnected: string[] = [];

        Object.keys(pod.peers).forEach((peerId) => {
            const peerInfo = pod.peers[peerId];
            if (peerInfo && now - peerInfo.lastSeen > this.PEER_TIMEOUT) {
                isDebug() &&
                    console.log(
                        `[HEALTH] Peer ${peerId} timed out (lastSeen: ${
                            now - peerInfo.lastSeen
                        }ms ago)`
                    );
                disconnected.push(peerId);
                try {
                    peerInfo.conn?.close();
                } catch (e) {
                    // ignore
                }
                delete pod.peers[peerId];
            }
        });

        if (disconnected.length > 0) {
            this.savePeerObjectData(state.id, pod);
        }

        return disconnected;
    }

    startHeartbeat(getState: () => any): void {
        if (this.heartbeatIntervalId) return;
        this.heartbeatIntervalId = setInterval(() => {
            this.sendHeartbeats(getState);
        }, this.HEARTBEAT_INTERVAL);
        this.healthCheckIntervalId = setInterval(() => {
            this.checkPeerHealth(getState);
        }, this.HEARTBEAT_INTERVAL);
    }

    stopHeartbeat(): void {
        if (this.heartbeatIntervalId) {
            clearInterval(this.heartbeatIntervalId);
            this.heartbeatIntervalId = null;
        }
        if (this.healthCheckIntervalId) {
            clearInterval(this.healthCheckIntervalId);
            this.healthCheckIntervalId = null;
        }
    }
}

// -- DSStore: effector store wrapper with P2P sync
export type StateWithId = { id: string } | null;
export type Reducer<State> = (state: State, payload: any) => State | void;
type Reducers<State> = { [key: string]: Reducer<State> };

class DSStore<State extends StateWithId> {
    private $store;
    private units: { [key: string]: EventCallable<any> };
    private localUnits: { [key: string]: EventCallable<any> };
    private getState: () => State;
    private computeChecksum?: (state: State) => string;
    private connection: DSConnection;

    constructor(
        $store: StoreWritable<State>,
        getState: () => State,
        connection: DSConnection,
        api?: Reducers<State>,
        computeChecksum?: (state: State) => string
    ) {
        this.$store = $store;
        this.getState = getState;
        this.connection = connection;
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

        const localEvent = createEvent<E>();
        this.localUnits[name] = localEvent;

        this.$store
            .on(trigger, (state, payload) => {
                const id = state?.id ?? (payload as any)?.id;
                isDebug() && console.log('trigger update', name, id, payload);
                if (!id) return state;
                const r = reducer(state, payload);
                isDebug() && console.log('reducer result for', name, r);
                if (r) {
                    this.connection.broadcastMessage({
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
    const connection = new DSConnection();
    const dsStore = new DSStore<State>(
        $store,
        getState,
        connection,
        api,
        computeChecksum
    );
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
                connection.updateClock(clock);
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
                const missedEvents: EventLogEntry[] = data.events ?? [];
                let maxClock = 0;
                for (const entry of missedEvents) {
                    if (entry.clock > maxClock) maxClock = entry.clock;
                    localEvents[entry.eventName]?.(entry.payload);
                }
                if (maxClock > 0) {
                    connection.setClock(maxClock);
                }
                return;
            }
            if (data?.action === 'ping') {
                const state = getState();
                const pod = state?.id
                    ? connection.getPeerData()[state.id]
                    : undefined;
                if (pod?.peers[message.peerId ?? '']) {
                    pod.peers[message.peerId ?? ''].lastSeen = Date.now();
                }
                conn.send({
                    type: 'control',
                    data: { action: 'pong' },
                });
                return;
            }
            if (data?.action === 'pong') {
                const state = getState();
                const pod = state?.id
                    ? connection.getPeerData()[state.id]
                    : undefined;
                if (pod?.peers[message.peerId ?? '']) {
                    pod.peers[message.peerId ?? ''].lastSeen = Date.now();
                }
                return;
            }
            return;
        }

        // Update our clock from incoming message
        if (message.clock !== undefined) {
            connection.updateClock(message.clock);
        }

        // Buffer and attempt to flush in order
        connection.bufferMessage(message, conn);
        connection.tryFlushBuffer(rawProcessMessage);
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
            const peerObjectData = await connection.initPeerConnection(
                id,
                processMessage,
                getState
            );
            setPeerId(peerObjectData.peerId);
            connection.startHeartbeat(getState);
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
            await connection.initPeerConnection(
                objectId,
                processMessage,
                getState
            );
            const conn = await connection.connectToPeer(
                objectId,
                peerId,
                processMessage
            );

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
        startHeartbeat: () => connection.startHeartbeat(getState),
        stopHeartbeat: () => connection.stopHeartbeat(),
        checkPeerHealth: () => connection.checkPeerHealth(getState),
        /** @internal Exposed for testing only */
        _test: {
            processMessage,
            rawProcessMessage,
            sendHeartbeats: () => connection.sendHeartbeats(getState),
            checkPeerHealth: () => connection.checkPeerHealth(getState),
            getCurrentClock: () => connection.getCurrentClock(),
            getPeerData: () => connection.getPeerData(),
        },
    };
}
