import { DataConnection, Peer } from 'peerjs';
import { Effect, EventCallable, StoreWritable } from 'effector';
import type { ChorusSession } from './session';

export type { ChorusSession };

// -- P2P message types
export interface Message {
    type: string;
    data?: any;
    clock?: number;
    peerId?: string;
    checksum?: string;
}

export interface PeerInfo {
    peerId: string;
    conn?: DataConnection;
    lastSeen: number;
}

export interface PeerObjectData {
    objectId: string;
    peerId: string;
    conn?: Peer;
    peers: PeersInfos;
}

export type PeersInfos = { [peerId: string]: PeerInfo };
export type PeerData = { [id: string]: PeerObjectData };

export type ProcessMessageType = (
    { type, data }: Message,
    conn: DataConnection
) => Promise<void>;

// -- Store types
export type StateWithId = { id: string } | null;
export type Reducer<State> = (state: State, payload: any) => State | void;
export type Reducers<State> = { [key: string]: Reducer<State> };

// -- Storage
export type StorageAdapter = 'indexeddb' | 'memory' | 'localstorage';

// -- Chorus options
export interface ChorusOptions {
    /** PeerJS server host. Defaults to '0.peerjs.com'. */
    peerHost?: string;
    /** Enable debug stores. Defaults to false. */
    debug?: boolean;
    /** Storage adapter. Defaults to 'indexeddb'. */
    storage?: StorageAdapter;
}

// -- Session config
export interface SessionConfig<State extends StateWithId> {
    /** Unique name for this session (used as the storage key). */
    name: string;
    /** Default state value. */
    defaultValue: State;
    /** P2P-synced reducers keyed by event name. */
    api?: Reducers<State>;
    /** Optional checksum function for divergence detection. */
    checksum?: (state: State) => string;
    /** Optional message interceptor. */
    onMessage?: (direction: 'in' | 'out', message: Message) => void;
    /** Build the join URL for a session. Defaults to `${origin}/join/${sessionId}/${peerId}`. */
    getJoinUrl?: (sessionId: string, peerId: string) => string;
}

// -- Workflow config
export interface WorkflowConfig<State extends StateWithId> {
    /**
     * Derive the current status from state. Used by the workflow engine.
     * Defaults to (state) => (state as any)?.status.
     */
    getStatus?: (state: State) => string | undefined;
    /**
     * Write the status to state. Auto-registers setStatus as a P2P-synced reducer.
     * Defaults to an idempotent reducer writing (state as any).status.
     */
    setStatus?: (state: State, status: string) => State | void;
    /**
     * Derive the context object passed to filter/logic for transitions
     * that don't define their own `context`. Defaults to (state) => ({ state }).
     */
    context?: (state: State) => any;
    /** The workflow transitions to register. */
    transitions: WorkflowTransition<State>[];
}

// -- Workflow
export interface WorkflowContext<State> {
    state: State;
    [key: string]: any;
}

export interface WorkflowTransition<State> {
    /** The status value this transition starts from. */
    from: string;
    /** Derive the context object passed to filter/logic. Defaults to (state) => ({ state }). */
    context?: (state: State) => any;
    /** When true, the transition fires. */
    filter: (context: any) => boolean;
    /** Optional side-effect logic. May return a function to call after advancing. */
    logic?: (context: any) => void | (() => any);
    /** The status value to advance to. */
    next?: string;
}

// -- Debug
export interface DebugMessage {
    id: string;
    direction: 'in' | 'out';
    timestamp: number;
    type: string;
    eventName?: string;
    action?: string;
    clock?: number;
    peerId?: string;
    checksum?: string;
    payload?: any;
}

export type JoinFxType = Effect<
    {
        objectId: string;
        peerId: string;
    },
    string,
    Error
>;

// -- Session API (returned by createSession)
export interface ChorusSessionApi<State extends StateWithId> {
    store: ChorusSession<State>;
    init: EventCallable<string>;
    $state: StoreWritable<State>;
    $peerId: StoreWritable<string | null>;
    /** Derived store: the active session id (from state.id). Only changes when the session id changes. */
    $id: StoreWritable<string | null>;
    useStore: () => State;
    usePeerId: () => string | null;
    joinFx: JoinFxType;
    events: { [key: string]: EventCallable<any> };
    /** React context provider supplying { sessionId, peerId, getJoinUrl } to Chorus components. */
    Provider: React.FC<{ children?: React.ReactNode }>;
    /** Build the join URL for this session. */
    getJoinUrl: (sessionId: string, peerId: string) => string;
    startHeartbeat: () => void;
    stopHeartbeat: () => void;
    checkPeerHealth: () => string[];
    workflows: (config: WorkflowConfig<State>) => void;
    /** @internal Exposed for testing only */
    _test: {
        processMessage: ProcessMessageType;
        rawProcessMessage: ProcessMessageType;
        sendHeartbeats: () => void;
        checkPeerHealth: () => string[];
        getCurrentClock: () => number;
        getPeerData: () => PeerData;
    };
}
