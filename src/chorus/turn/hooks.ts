import { useSessionState } from '../core/context';
import { Turn, TurnSessionState } from './types';

/**
 * Read the current (last) turn from the session state.
 * Must be used within a session Provider.
 */
export const useTurn = <TStatus extends string = string, TTurnData = any>():
    Turn<TStatus, TTurnData> | undefined => {
    const state = useSessionState<TurnSessionState<
        TStatus,
        TTurnData
    > | null>();
    return state?.turns?.[state.turns.length - 1];
};

/**
 * Read the previous (second-to-last) turn from the session state.
 * Must be used within a session Provider.
 */
export const usePreviousTurn = <
    TStatus extends string = string,
    TTurnData = any,
>(): Turn<TStatus, TTurnData> | undefined => {
    const state = useSessionState<TurnSessionState<
        TStatus,
        TTurnData
    > | null>();
    return state?.turns?.[state.turns.length - 2];
};

/**
 * Read the current turn's status.
 * Must be used within a session Provider.
 */
export const useTurnStatus = <
    TStatus extends string = string,
>(): TStatus | null => {
    const turn = useTurn<TStatus, any>();
    return turn?.status ?? null;
};

/**
 * Read a specific participant's turn data from the current turn.
 * Must be used within a session Provider.
 */
export const useParticipantTurn = <TTurnData = any>(
    participantId: string
): TTurnData | undefined => {
    const turn = useTurn<string, TTurnData>();
    return turn?.participants?.[participantId];
};

/**
 * Read all participants' turn data from the current turn.
 * Must be used within a session Provider.
 */
export const useTurnParticipants = <TTurnData = any>(): {
    [participantId: string]: TTurnData;
} => {
    const turn = useTurn<string, TTurnData>();
    return turn?.participants ?? {};
};

/**
 * Find a participant's turn data by predicate.
 * Must be used within a session Provider.
 */
export const useTurnParticipantByPredicate = <TTurnData = any>(
    predicate: (participantTurn: TTurnData) => boolean
): TTurnData | undefined => {
    const participants = useTurnParticipants<TTurnData>();
    const key = Object.keys(participants).find((k) =>
        predicate(participants[k])
    );
    return key ? participants[key] : undefined;
};
