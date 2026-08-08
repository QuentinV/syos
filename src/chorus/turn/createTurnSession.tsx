import { createStore, EventCallable, sample, Store } from 'effector';
import { useUnit } from 'effector-react';
import React from 'react';
import { ChorusTurnContext, ChorusTurnHooks } from './context';
import {
    ChorusSessionApi,
    Reducers,
    SessionConfig,
    StateWithId,
    WorkflowConfig,
} from '../core/types';
import {
    useTurn,
    usePreviousTurn,
    useTurnStatus,
    useParticipantTurn,
    useTurnParticipants,
    useTurnParticipantByPredicate,
} from './hooks';
import { Participant, Turn, TurnSessionState } from './types';
import { createParticipantStore, ParticipantStore } from './participant';
import { computeTurnSessionChecksum } from './checksum';

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
    /**
     * Storage key for the local participant store. Default to "participant".
     * API as `$participant` / `setParticipantName`, enabling the
     * `useLocalParticipantTurn` hook.
     */
    participantStorageKey?: string;
    /**
     * When true, the local participant is automatically added to the session
     * if they aren't already present. Defaults to true.
     */
    autoJoinParticipant?: boolean;
}

export interface TurnSessionApi<
    TStatus extends string = string,
    TTurnData = any,
    Api extends Reducers<TurnState<TStatus, TTurnData>> = {},
>
    extends
        Omit<
            ChorusSessionApi<TurnState<TStatus, TTurnData>>,
            'events' | 'workflows'
        >,
        ChorusTurnHooks<TStatus, TTurnData> {
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
        /** Merge partial updates into the current turn's per-participant data. */
        updateTurnParticipants: EventCallable<{
            [participantId: string]: Partial<TTurnData>;
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
    /**
     * The local participant store, created internally when
     * `participantStorageKey` is provided in the config.
     */
    participantStore?: ParticipantStore;
}

/**
 * Build a `createTurnSession` factory bound to a specific `createSession`.
 *
 * The turn layer is opt-in: it wraps the generic `createSession` with
 * turn-session semantics (participants, turns, current-turn status workflow),
 * while remaining fully generic over the app-specific turn status values
 * and per-participant data.
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

        config.checksum = config.checksum ?? computeTurnSessionChecksum;

        // -- Local participant store
        config.participantStorageKey =
            config.participantStorageKey ?? 'participant';
        const participantStore = createParticipantStore(
            config.participantStorageKey
        );

        // -- Generic turn reducers (merged with the app-specific api)
        const genericApi: Reducers<State> = {
            updateState: (_, newState) => (newState ? { ...newState } : null),

            toggleParticipantReady: (state, participantId: string) => {
                if (!state) return null;
                const participant = state.participants[participantId];
                if (!participant) return state;
                return {
                    ...state,
                    participants: {
                        ...state.participants,
                        [participantId]: {
                            ...participant,
                            ready: !participant.ready,
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
                if (state.participants[participant.id]) return state;
                return {
                    ...state,
                    participants: {
                        ...state.participants,
                        [participant.id]: participant,
                    },
                };
            },

            updateTurnParticipants: (state, updates) => {
                if (!state) return null;
                const lastIndex = state.turns.length - 1;
                if (lastIndex < 0) return state;

                let changed = false;
                const turn = state.turns[lastIndex];
                const participants = { ...turn.participants };

                Object.keys(updates).forEach((pk) => {
                    const participantTurn = participants[pk];
                    if (!participantTurn) return;
                    const merged = { ...participantTurn, ...updates[pk] };
                    if (
                        JSON.stringify(participantTurn) !==
                        JSON.stringify(merged)
                    ) {
                        changed = true;
                        participants[pk] = merged as TTurnData;
                    }
                });

                if (!changed) return state;
                const updatedTurn = { ...turn, participants };
                return {
                    ...state,
                    turns: [...state.turns.slice(0, lastIndex), updatedTurn],
                };
            },
        };

        // -- Typed turn hooks: stable closures binding TStatus/TTurnData.
        // They're provided via the dedicated turn context and also returned
        // directly on the session API for convenience.
        const turnHooks: ChorusTurnHooks<TStatus, TTurnData> = {
            useTurn: () => useTurn<TStatus, TTurnData>(),
            usePreviousTurn: () => usePreviousTurn<TStatus, TTurnData>(),
            useTurnStatus: () => useTurnStatus<TStatus>(),
            useParticipantTurn: (participantId: string) =>
                useParticipantTurn<TTurnData>(participantId),
            useTurnParticipants: () => useTurnParticipants<TTurnData>(),
            useTurnParticipantByPredicate: (
                predicate: (participantTurn: TTurnData) => boolean
            ) => useTurnParticipantByPredicate<TTurnData>(predicate),
            useLocalParticipantTurn: () => {
                const $participant = participantStore?.$participant;
                const participant = useUnit($participant);
                return useParticipantTurn<TTurnData>(participant?.id ?? '');
            },
            useLocalParticipant: () => {
                const $participant = participantStore?.$participant;
                return useUnit($participant) ?? undefined;
            },
        };

        const session = createSession<State>({
            ...config,
            api: {
                ...genericApi,
                ...(config.api ?? {}),
            },
        });

        // -- Auto-join (opt-in): when the local participant isn't in the
        // session yet, add them. This is a generic turn-session concern for
        // apps that want the local participant to join automatically.
        config.autoJoinParticipant = config.autoJoinParticipant ?? true;
        if (config.autoJoinParticipant) {
            sample({
                clock: session.$state,
                source: participantStore.$participant,
                filter: (participant, state) =>
                    state !== null &&
                    participant !== null &&
                    !state.participants[participant.id],
                fn: (participant) => participant,
                target: session.events.joinParticipant,
            });
        }

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
                context: workflowConfig.context,
                transitions: workflowConfig.transitions,
            });
        };

        // -- Turn Provider: composes the session provider with the dedicated
        // turn context. Only turn sessions supply the turn context, so hooks
        // consumed via `useChorusTurn()` are available exclusively here.
        const TurnProvider: React.FC<{ children?: React.ReactNode }> = ({
            children,
        }) =>
            React.createElement(
                session.Provider,
                null,
                React.createElement(
                    ChorusTurnContext.Provider,
                    { value: turnHooks },
                    children
                )
            );

        return {
            ...session,
            Provider: TurnProvider,
            ...turnHooks,
            events: session.events as TurnSessionApi<
                TStatus,
                TTurnData,
                Api
            >['events'],
            workflows: turnWorkflows,
            ...(participantStore ? { participantStore } : {}),
        };
    };
}
