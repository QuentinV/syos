import { createContext, useContext } from 'react';
import { Participant, Turn } from './types';

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
    useLocalParticipantTurn: () => TTurnData | undefined;
    /** The local participant ({ id, name, ready }). Requires `participantStore` in the session config. */
    useLocalParticipant: () => Participant | undefined;
}

/**
 * Default no-op turn hooks for non-turn sessions. Turn-based sessions
 * override these via the turn context with typed implementations.
 */
export const defaultTurnHooks: ChorusTurnHooks = {
    useTurn: () => undefined,
    usePreviousTurn: () => undefined,
    useTurnStatus: () => null,
    useParticipantTurn: () => undefined,
    useTurnParticipants: () => ({}),
    useTurnParticipantByPredicate: () => undefined,
    useLocalParticipantTurn: () => undefined,
    useLocalParticipant: () => undefined,
};

/**
 * Dedicated context for turn-only hooks. Supplied exclusively by the
 * `Provider` returned from `createTurnSession`, keeping turn concerns
 * separate from the generic session context.
 */
export const ChorusTurnContext = createContext<ChorusTurnHooks | null>(null);

export const useChorusTurn = <
    TStatus extends string = string,
    TTurnData = any,
>(): ChorusTurnHooks<TStatus, TTurnData> => {
    const ctx = useContext(ChorusTurnContext);
    if (!ctx) {
        throw new Error(
            'useChorusTurn must be used within a turn session Provider. ' +
                'Wrap your component with the Provider returned by createTurnSession().'
        );
    }
    return ctx as ChorusTurnHooks<TStatus, TTurnData>;
};

// ============================================================
// Direct shortcut hooks.
//
// These delegate to the typed closures stored in the turn context,
// so they can be imported and called directly from any component
// rendered within a turn session Provider — no need to destructure
// the hooks off the session API or call `useChorusTurn()` yourself.
// ============================================================

/**
 * Read the current (last) turn from the turn session context.
 * Must be used within a turn session Provider.
 */
export const useTurn = <TStatus extends string = string, TTurnData = any>():
    Turn<TStatus, TTurnData> | undefined =>
    useChorusTurn<TStatus, TTurnData>().useTurn();

/**
 * Read the previous (second-to-last) turn from the turn session context.
 * Must be used within a turn session Provider.
 */
export const usePreviousTurn = <
    TStatus extends string = string,
    TTurnData = any,
>(): Turn<TStatus, TTurnData> | undefined =>
    useChorusTurn<TStatus, TTurnData>().usePreviousTurn();

/**
 * Read the current turn's status from the turn session context.
 * Must be used within a turn session Provider.
 */
export const useTurnStatus = <
    TStatus extends string = string,
>(): TStatus | null => useChorusTurn<TStatus, any>().useTurnStatus();

/**
 * Read a specific participant's turn data from the current turn.
 * Must be used within a turn session Provider.
 */
export const useParticipantTurn = <TTurnData = any>(
    participantId: string
): TTurnData | undefined =>
    useChorusTurn<string, TTurnData>().useParticipantTurn(participantId);

/**
 * Read all participants' turn data from the current turn.
 * Must be used within a turn session Provider.
 */
export const useTurnParticipants = <TTurnData = any>(): {
    [participantId: string]: TTurnData;
} => useChorusTurn<string, TTurnData>().useTurnParticipants();

/**
 * Find a participant's turn data by predicate.
 * Must be used within a turn session Provider.
 */
export const useTurnParticipantByPredicate = <TTurnData = any>(
    predicate: (participantTurn: TTurnData) => boolean
): TTurnData | undefined =>
    useChorusTurn<string, TTurnData>().useTurnParticipantByPredicate(predicate);

/**
 * Read the local participant's turn data in the current turn.
 * Requires `participantStore` in the session config.
 * Must be used within a turn session Provider.
 */
export const useLocalParticipantTurn = <TTurnData = any>():
    TTurnData | undefined =>
    useChorusTurn<string, TTurnData>().useLocalParticipantTurn();

/**
 * Read the local participant ({ id, name, ready }) from the turn session context.
 * Requires `participantStore` in the session config.
 * Must be used within a turn session Provider.
 */
export const useLocalParticipant = (): Participant | undefined =>
    useChorusTurn().useLocalParticipant();
