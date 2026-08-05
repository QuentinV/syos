import { describe, it, expect, vi, beforeEach } from 'vitest';

let createChorus: typeof import('../index').createChorus;

beforeEach(async () => {
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => {
            store[key] = value;
        },
        removeItem: (key: string) => {
            delete store[key];
        },
        clear: () => {
            Object.keys(store).forEach((k) => delete store[k]);
        },
    });

    const mod = await import('../index');
    createChorus = mod.createChorus;
});

// ============================================================
// Scrum planning — a second, non-game consumer that proves the
// turn layer is fully generic over TStatus + TTurnData.
// ============================================================

type ScrumStatus = 'discuss' | 'vote' | 'revealed';

interface ScrumPlayerTurn {
    playerId: string;
    vote?: number;
    votedTime?: number;
}

type ScrumState = {
    id: string;
    players: { [playerId: string]: import('../index').Participant };
    turns: import('../index').Turn<ScrumStatus, ScrumPlayerTurn>[];
    status: import('../index').SessionStatus;
    createdAt: number;
} | null;

describe('Chorus — createTurnSession (Scrum Planning example)', () => {
    it('should create a turn session with generic turn semantics', () => {
        const chorus = createChorus({ storage: 'memory' });
        const session = chorus.createTurnSession<ScrumStatus, ScrumPlayerTurn>({
            name: 'scrum',
            defaultValue: {
                id: 'scrum-1',
                players: {},
                turns: [],
                status: 'lobby',
                createdAt: Date.now(),
            },
        });

        // Generic turn events exist
        expect(session.events['toggleParticipantReady']).toBeDefined();
        expect(session.events['startSession']).toBeDefined();
        expect(session.events['endSession']).toBeDefined();
        expect(session.events['addTurn']).toBeDefined();
        expect(session.events['joinParticipant']).toBeDefined();
        expect(session.events['updateTurnPlayers']).toBeDefined();
    });

    it('should join participants, start the session, add a turn, and vote', () => {
        const chorus = createChorus({ storage: 'memory' });
        const session = chorus.createTurnSession<ScrumStatus, ScrumPlayerTurn>({
            name: 'scrum',
            defaultValue: {
                id: 'scrum-1',
                players: {},
                turns: [],
                status: 'lobby',
                createdAt: Date.now(),
            },
            api: {
                vote: (
                    state: import('../index').TurnState<
                        ScrumStatus,
                        ScrumPlayerTurn
                    >,
                    payload: { playerId: string; vote: number }
                ) => {
                    if (!state) return null;
                    const lastIndex = state.turns.length - 1;
                    if (lastIndex < 0) return state;
                    const turn = state.turns[lastIndex];
                    const playerTurn = turn.players[payload.playerId];
                    if (!playerTurn) return state;
                    const updatedTurn = {
                        ...turn,
                        players: {
                            ...turn.players,
                            [payload.playerId]: {
                                ...playerTurn,
                                vote: payload.vote,
                                votedTime: Date.now(),
                            },
                        },
                    };
                    return {
                        ...state,
                        turns: [
                            ...state.turns.slice(0, lastIndex),
                            updatedTurn,
                        ],
                    };
                },
            },
        });

        // Join participants
        session.events['joinParticipant']({
            id: 'dev-1',
            name: 'Alice',
            ready: false,
        });
        session.events['joinParticipant']({
            id: 'dev-2',
            name: 'Bob',
            ready: false,
        });

        let state = session.$state.getState();
        expect(Object.keys(state!.players)).toEqual(['dev-1', 'dev-2']);

        // Toggle ready + start session
        session.events['toggleParticipantReady']('dev-1');
        session.events['toggleParticipantReady']('dev-2');
        session.events['startSession']();

        state = session.$state.getState();
        expect(state!.status).toBe('running');

        // Add a turn (scrum planning round) with per-player slots
        session.events['addTurn']({
            status: 'discuss',
            players: {
                'dev-1': { playerId: 'dev-1' },
                'dev-2': { playerId: 'dev-2' },
            },
        });

        // Vote via app-specific reducer
        session.events['vote']({ playerId: 'dev-1', vote: 5 });

        state = session.$state.getState();
        expect(state!.turns).toHaveLength(1);
        expect(state!.turns[0].status).toBe('discuss');
        expect(state!.turns[0].players['dev-1'].vote).toBe(5);
    });

    it('should keep session status fixed enum while turn status is generic', () => {
        const chorus = createChorus({ storage: 'memory' });
        const session = chorus.createTurnSession<ScrumStatus, ScrumPlayerTurn>({
            name: 'scrum',
            defaultValue: {
                id: 'scrum-1',
                players: {},
                turns: [],
                status: 'lobby',
                createdAt: Date.now(),
            },
        });

        session.events['startSession']();
        expect(session.$state.getState()!.status).toBe('running');

        session.events['endSession']();
        expect(session.$state.getState()!.status).toBe('finished');
    });
});
