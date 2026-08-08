import Peer, { DataConnection } from 'peerjs';
import { v4 as uuid } from 'uuid';
import {
    Message,
    PeerData,
    PeerInfo,
    PeerObjectData,
    PeersInfos,
    ProcessMessageType,
} from './types';

const DEBUG = false;

const isDebug = () => DEBUG;

// -- ChorusConnection: encapsulates all P2P state per session
export class ChorusConnection {
    private lamportClock = 0;
    private eventBuffer: {
        message: Message;
        conn: DataConnection;
    }[] = [];
    private flushTimeoutId: ReturnType<typeof setTimeout> | null = null;
    private lastAppliedClock = 0;
    private peerData: PeerData;
    private peerHost: string;

    // Heartbeat
    private heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;
    private healthCheckIntervalId: ReturnType<typeof setInterval> | null = null;
    private readonly HEARTBEAT_INTERVAL = 5000;
    private readonly PEER_TIMEOUT = 15000;

    // Debug interceptor — called for every incoming/outgoing message
    onMessage?: (direction: 'in' | 'out', message: Message) => void;

    constructor(peerHost = '0.peerjs.com') {
        this.peerHost = peerHost;
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
            host: this.peerHost,
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
        newState,
    }: {
        objectId: string;
        message: Message;
        getState?: () => any;
        computeChecksum?: (state: any) => string;
        newState?: any;
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

        // Compute checksum from the new state (post-mutation) if provided,
        // otherwise fall back to getState() (which may return the old state
        // if called inside a reducer before the store has committed)
        if (computeChecksum) {
            const stateForChecksum = newState ?? getState?.();
            if (stateForChecksum !== undefined) {
                stamped.checksum = computeChecksum(stateForChecksum);
            }
        }

        // Defer onMessage callback to avoid effector "pure function" error
        // when called from within a reducer (e.g., broadcastMessage is called
        // from the on() method's trigger handler which runs in a store reducer)
        if (this.onMessage) {
            const { onMessage } = this;
            setTimeout(() => onMessage('out', stamped), 0);
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
