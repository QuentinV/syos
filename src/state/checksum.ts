import { Game } from './types';

export const computeGameChecksum = (state: Game | null): string => {
    if (!state) return 'null';
    const playerSummary = Object.keys(state.players)
        .sort()
        .map((pk) => {
            const p = state.players[pk];
            return `${p.id}:${p.ready ? '1' : '0'}`;
        })
        .join(',');
    const turnSummary = state.turns
        .map((t) => `${t.status}:${Object.keys(t.players).length}`)
        .join(';');
    return [state.id, state.status, turnSummary, playerSummary].join('|');
};
