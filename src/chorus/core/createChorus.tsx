import { createEffect, createEvent, createStore, sample } from 'effector';
import { useUnit } from 'effector-react';
import React from 'react';
import { DataConnection } from 'peerjs';
import { ChorusConnection } from './connection';
import { ChorusSession } from './session';
import { createStorage, Storage } from './storage';
import { createWorkflowEngine } from './workflow';
import { debug as debugApi, logDebugMessage } from '../debug/debug';
import { ChorusSessionContext } from './context';
import { createTurnSessionFactory } from '../turn';
import {
    appendToEventLog,
    getEventsSinceClock,
    getLatestClock,
    EventLogEntry,
} from '../debug/eventLog';
import {
    ChorusOptions,
    ChorusSessionApi,
    JoinFxType,
    Message,
    SessionConfig,
    StateWithId,
    WorkflowConfig,
} from './types';

const DEBUG = false;

const isDebug = () => DEBUG;

export function createChorus(options: ChorusOptions = {}) {
    const peerHost = options.peerHost ?? '0.peerjs.com';
    const storage: Storage = createStorage(options.storage ?? 'indexeddb');

    function createSession<State extends StateWithId>(
        config: SessionConfig<State>
    ): ChorusSessionApi<State> {
        const $store = createStore<State>(config.defaultValue);
        const $peerId = createStore<string | null>(null);
        // Derived store: only changes when the session id changes (not on every state mutation)
        const $id = createStore<string | null>(null).on(
            $store.updates,
            (_, state) => state?.id ?? null
        );

        const getState = () => $store.getState();
        const connection = new ChorusConnection(peerHost);

        const getJoinUrl =
            config.getJoinUrl ??
            ((sessionId: string, peerId: string) =>
                `${document.location.origin}/join/${sessionId}/${peerId}`);

        // Wire debug interceptor if enabled
        if (options.debug) {
            connection.onMessage = (direction, message) => {
                logDebugMessage({ direction, message });
            };
        } else if (config.onMessage) {
            connection.onMessage = config.onMessage;
        }

        const dsStore = new ChorusSession<State>(
            $store,
            getState,
            connection,
            config.api,
            config.checksum
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
            }
        };

        const processMessage = async (
            message: Message,
            conn: DataConnection
        ) => {
            connection.onMessage?.('in', message);

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
                    const events = await getEventsSinceClock(
                        data.sinceClock ?? 0
                    );
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

            // Process messages without a clock immediately (e.g., setState from host)
            if (message.clock === undefined) {
                rawProcessMessage(message, conn);
                return;
            }

            // Update our clock from incoming message
            connection.updateClock(message.clock);

            // Buffer and attempt to flush in order
            connection.bufferMessage(message, conn);
            connection.tryFlushBuffer(rawProcessMessage);
        };

        const loadFromStorageFx = createEffect(
            async (objectId: string) =>
                (await storage.get({ storeName: config.name, id: objectId })) ??
                null
        );

        $store.on(loadFromStorageFx.doneData, (_, state) => state);
        $peerId.on(setPeerId, (_, state) => state);

        sample({
            source: $store,
            target: createEffect(async (object: State | null) => {
                if (!object) return;
                await storage.put({
                    storeName: config.name,
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

        const joinFx: JoinFxType = createEffect(
            async ({
                objectId,
                peerId,
            }: {
                objectId: string;
                peerId: string;
            }) => {
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

        const hooks = {
            useStore: () => useUnit($store),
            usePeerId: () => useUnit($peerId),
        };

        const Provider: React.FC<{ children?: React.ReactNode }> = ({
            children,
        }) => {
            const sessionId = useUnit($id);
            const peerId = useUnit($peerId);
            if (!sessionId || !peerId) return null;
            return (
                <ChorusSessionContext.Provider
                    value={{
                        sessionId,
                        getJoinUrl,
                        joinFx,
                        checksum: config.checksum,
                        $store,
                        $id,
                        $peerId,
                        events,
                    }}
                >
                    {children}
                </ChorusSessionContext.Provider>
            );
        };

        return {
            store: dsStore,
            init: initObject,
            $state: $store,
            $peerId,
            $id,
            useStore: hooks.useStore,
            usePeerId: hooks.usePeerId,
            joinFx,
            events,
            Provider,
            getJoinUrl,
            startHeartbeat: () => connection.startHeartbeat(getState),
            stopHeartbeat: () => connection.stopHeartbeat(),
            checkPeerHealth: () => connection.checkPeerHealth(getState),
            workflows: (config: WorkflowConfig<State>) => {
                // Default getStatus: read `status` field from state
                const getStatus =
                    config.getStatus ??
                    ((state: State) =>
                        (state as any)?.status as string | undefined);

                // setStatus event — registered lazily on first workflows() call
                const setStatus = createEvent<string>();

                // Default setStatus: idempotent reducer writing `status` field
                const setStatusReducer =
                    config.setStatus ??
                    ((state: State, status: string) => {
                        if (!state) return state;
                        if ((state as any)?.status === status) return state;
                        return { ...(state as any), status } as State;
                    });

                // Register setStatus as a P2P-synced reducer
                dsStore.on('setStatus', setStatus, setStatusReducer);

                createWorkflowEngine({
                    $state: $store,
                    getStatus,
                    setStatus,
                    context: config.context,
                    transitions: config.transitions,
                });
            },
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

    const createTurnSession = createTurnSessionFactory(createSession);

    return {
        createSession,
        createTurnSession,
        debug: debugApi,
    };
}
