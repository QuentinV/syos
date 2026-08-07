import { TurnSessionState } from './types';

/**
 * Generic checksum for turn-based session states.
 *
 * Computes a deterministic hash from the stable, structural fields of a
 * turn-based state: id, session status, turn count, each turn's status,
 * and the sorted participant keys. App-specific deep fields (per-participant
 * turn data) are intentionally excluded — like the original game checksum,
 * this detects divergence in the flow-relevant fields.
 */
export const computeTurnSessionChecksum = <TStatus extends string, TTurnData>(
    state: TurnSessionState<TStatus, TTurnData> | null
): string => {
    if (!state) return 'null';
    const participantSummary = Object.keys(state.participants)
        .sort()
        .map((pk) => `${pk}:${state.participants[pk].ready ? '1' : '0'}`)
        .join(',');
    const turnSummary = state.turns
        .map((t) => `${t.status}:${Object.keys(t.participants).length}`)
        .join(';');
    return [state.id, state.status, turnSummary, participantSummary].join('|');
};
