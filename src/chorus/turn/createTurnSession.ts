import { EventCallable } from 'effector';
import {
    ChorusSessionApi,
    Reducers,
    SessionConfig,
    StateWithId,
    WorkflowConfig,
} from '../types';
import { Participant, Turn, TurnSessionState } from './types';

export type TurnState<TStatus extends string, TTurnData> = TurnSessionState<
    TStatus,
    TTurnData
> | null;

export interface TurnSessionConfig<
    TStatus extends string = string,
    TTurnData = any,
    Api extends Reducers<TurnState<TStatus, TTurnData>> = {},
> extends Omit<
    SessionConfig<TurnState<TStatus, TTurnData>>,
    'api' | 'defaultValue'
> {
    defaultValue: TurnState<TStatus, TTurnData>;
    /** App-specific P2P-synced reducers (merged with the generic turn reducers). */
    api?: Api;
}

export interface TurnSessionApi<
    TStatus extends string = string,
    TTurnData = any,
    Api extends Reducers<TurnState<TStatus, TTurnData>> = {},
> extends Omit<
    ChorusSessionApi<TurnState<TStatus, TTurnData>>,
    'events' | 'workflows'
> {
    events: {
        /** Replace the whole session state (e.g. after creating a new session). */
        updateState: EventCallable<TurnSessionState<TStatus, TTurnData>>;
        /** Toggle a participant's ready flag. */
        toggleParticipantReady: EventCallable<string>;
        /** Advance the session status to 'running'. */
        startSession: EventCallable<void>;
        /** Advance the session status to 'finished'. */
        endSession: EventCallable<void>;
        /** Append a turn to the session. */
        addTurn: EventCallable<Turn<TStatus, TTurnData> | undefined>;
        /** Add a participant to the session (no-op if already present). */
        joinParticipant: EventCallable<Participant>;
        /** Merge partial updates into the current turn's per-player data. */
        updateTurnPlayers: EventCallable<{
            [playerId: string]: Partial<TTurnData>;
        }>;
    } & { [K in keyof Api]: EventCallable<any> } & {
        [key: string]: EventCallable<any>;
    };
    /**
     * Register workflow transitions. Unlike `createSession`, the default
     * `getStatus`/`setStatus` target the *current turn's* status rather than
     * a top-level `status` field. The top-level session status remains
     * `'lobby' | 'running' | 'finished'` (managed by startSession/endSession).
     */
    workflows: (
        config: Omit<
            WorkflowConfig<TurnState<TStatus, TTurnData>>,
            'getStatus' | 'setStatus'
        >
    ) => void;
}

/**
 * Build a `createTurnSession` factory bound to a specific `createSession`.
 *
 * The turn layer is opt-in: it wraps the generic `createSession` with
 * turn-session semantics (participants, turns, current-turn status workflow),
 * while remaining fully generic over the app-specific turn status values
 * and per-player data.
 */
export function createTurnSessionFactory(
    createSession: <S extends StateWithId>(
        config: SessionConfig<S>
    ) => ChorusSessionApi<S>
) {
    return function createTurnSession<
        TStatus extends string = string,
        TTurnData = any,
        Api extends Reducers<TurnState<TStatus, TTurnData>> = {},
    >(
        config: TurnSessionConfig<TStatus, TTurnData, Api>
    ): TurnSessionApi<TStatus, TTurnData, Api> {
        type State = TurnState<TStatus, TTurnData>;

        // -- Generic turn reducers (merged with the app-specific api)
        const genericApi: Reducers<State> = {
            updateState: (_, newState) => (newState ? { ...newState } : null),

            toggleParticipantReady: (state, participantId: string) => {
                if (!state) return null;
                const player = state.players[participantId];
                if (!player) return state;
                return {
                    ...state,
                    players: {
                        ...state.players,
                        [participantId]: {
                            ...player,
                            ready: !player.ready,
                        },
                    },
                };
            },

            startSession: (state) =>
                state ? { ...state, status: 'running' } : null,

            endSession: (state) =>
                state ? { ...state, status: 'finished' } : null,

            addTurn: (state, turn) =>
                state && turn
                    ? { ...state, turns: [...state.turns, turn] }
                    : state,

            joinParticipant: (state, participant: Participant) => {
                if (!state || !participant) return state;
                if (state.players[participant.id]) return state;
                return {
                    ...state,
                    players: {
                        ...state.players,
                        [participant.id]: participant,
                    },
                };
            },

            updateTurnPlayers: (state, updates) => {
                if (!state) return null;
                const lastIndex = state.turns.length - 1;
                if (lastIndex < 0) return state;

                let changed = false;
                const turn = state.turns[lastIndex];
                const players = { ...turn.players };

                Object.keys(updates).forEach((pk) => {
                    const playerTurn = players[pk];
                    if (!playerTurn) return;
                    const merged = { ...playerTurn, ...updates[pk] };
                    if (JSON.stringify(playerTurn) !== JSON.stringify(merged)) {
                        changed = true;
                        players[pk] = merged as TTurnData;
                    }
                });

                if (!changed) return state;
                const updatedTurn = { ...turn, players };
                return {
                    ...state,
                    turns: [...state.turns.slice(0, lastIndex), updatedTurn],
                };
            },
        };

        const session = createSession<State>({
            ...config,
            api: {
                ...genericApi,
                ...(config.api ?? {}),
            },
        });

        // -- Turn-aware workflow: getStatus/setStatus target the current turn's status
        const turnWorkflows: TurnSessionApi<
            TStatus,
            TTurnData,
            Api
        >['workflows'] = (workflowConfig) => {
            const getStatus = (state: State) =>
                state?.turns?.[state.turns.length - 1]?.status as
                    string | undefined;

            const setStatus = (state: State, status: string) => {
                if (!state) return state;
                const lastIndex = state.turns.length - 1;
                if (lastIndex < 0) return state;
                const turn = state.turns[lastIndex];
                if (turn.status === status) return state;
                const updatedTurn = { ...turn, status: status as TStatus };
                return {
                    ...state,
                    turns: [...state.turns.slice(0, lastIndex), updatedTurn],
                };
            };

            session.workflows({
                getStatus,
                setStatus,
                transitions: workflowConfig.transitions,
            });
        };

        return {
            ...session,
            events: session.events as TurnSessionApi<
                TStatus,
                TTurnData,
                Api
            >['events'],
            workflows: turnWorkflows,
        };
    };
}
