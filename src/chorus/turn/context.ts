import { createContext, useContext } from 'react';
import { Turn } from './types';

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
    useActiveParticipant: () => undefined,
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
