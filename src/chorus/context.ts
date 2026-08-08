import { createContext, useContext } from 'react';
import { EventCallable, Store } from 'effector';
import { useUnit } from 'effector-react';
import { Turn } from './turn/types';

/**
 * Typed turn hooks exposed by turn-based sessions.
 *
 * These are stable closures created once by `createTurnSession`, so they
 * capture `TStatus`/`TTurnData` and need no type parameters at call sites.
 */
export interface ChorusTurnHooks<
    TStatus extends string = string,
    TTurnData = any,
> {
    useTurn: () => Turn<TStatus, TTurnData> | undefined;
    usePreviousTurn: () => Turn<TStatus, TTurnData> | undefined;
    useTurnStatus: () => TStatus | null;
    useParticipantTurn: (participantId: string) => TTurnData | undefined;
    useTurnParticipants: () => { [participantId: string]: TTurnData };
    useTurnParticipantByPredicate: (
        predicate: (participantTurn: TTurnData) => boolean
    ) => TTurnData | undefined;
    /** The local participant's turn data in the current turn. Requires `participantStore` in the session config. */
    useActiveParticipant: () => TTurnData | undefined;
}

export interface ChorusSessionContextValue<
    TStatus extends string = string,
    TTurnData = any,
> extends ChorusTurnHooks<TStatus, TTurnData> {
    sessionId: string;
    getJoinUrl: (sessionId: string, peerId: string) => string;
    checksum?: (state: any) => string;
    // Stable references — identity never changes, so the context value stays stable.
    // Consumers read live values via useUnit(ctx.$store) / useUnit(ctx.$id) / useUnit(ctx.$peerId).
    $store: Store<any>; // Store<State> (read-only view)
    $id: Store<string | null>;
    $peerId: Store<string | null>;
    events: { [key: string]: EventCallable<any> }; // matches ChorusSession.getUnits()
}

/**
 * Default no-op turn hooks for non-turn sessions. Turn-based sessions
 * override these via `valueExtras` with typed implementations.
 */
export const defaultTurnHooks: ChorusTurnHooks = {
    useTurn: () => undefined,
    usePreviousTurn: () => undefined,
    useTurnStatus: () => null,
    useParticipantTurn: () => undefined,
    useTurnParticipants: () => ({}),
    useTurnParticipantByPredicate: () => undefined,
    useActiveParticipant: () => undefined,
};

export const ChorusSessionContext =
    createContext<ChorusSessionContextValue | null>(null);

export const useChorusSession = <
    TStatus extends string = string,
    TTurnData = any,
>(): ChorusSessionContextValue<TStatus, TTurnData> => {
    const ctx = useContext(ChorusSessionContext);
    if (!ctx) {
        throw new Error(
            'useChorusSession must be used within a session Provider. ' +
                'Wrap your component with the Provider returned by createSession().'
        );
    }
    return ctx as ChorusSessionContextValue<TStatus, TTurnData>;
};

/**
 * Read the session state store from the session context.
 * Must be used within a session Provider.
 */
export const useSessionState = <State = any>(): State => {
    const { $store } = useChorusSession();
    return useUnit($store);
};

/**
 * Read the active session id from the session context.
 * Must be used within a session Provider.
 */
export const useSessionId = (): string | null => {
    const { $id } = useChorusSession();
    return useUnit($id);
};

/**
 * Read this peer's id from the session context.
 * Must be used within a session Provider.
 */
export const useSessionPeerId = (): string | null => {
    const { $peerId } = useChorusSession();
    return useUnit($peerId);
};
