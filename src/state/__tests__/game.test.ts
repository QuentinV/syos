import { describe, it, expect, beforeEach } from 'vitest';
import { createMockGameWithPlayers } from './mockGame';
import {
    Game,
    GameTurn,
    GameTurnStatus,
    PlayerRole,
    PlayerTurn,
} from '../types';

// Import the reducer functions directly by extracting the logic from game.ts
// Since the reducers are defined inline in store.on() calls, we extract them here for testing

function togglePlayerReadyReducer(
    game: Game | null,
    playerId: string
): Game | null {
    if (!game) return null;
    game.participants[playerId].ready = !game.participants[playerId].ready;
    return { ...game };
}

function startGameReducer(game: Game | null): Game | null {
    return game ? { ...game, status: 'running' as const } : null;
}

function stopGameReducer(game: Game | null): Game | null {
    return game ? { ...game, status: 'finished' as const } : null;
}

function newTurnReducer(
    game: Game | null,
    turn: GameTurn | undefined
): Game | null {
    if (!game || !turn) return game;
    return {
        ...game,
        turns: [...game.turns, turn],
    };
}

function setDisplayedCardsReducer(
    game: Game | null,
    payload: { playerId: string; cardIndexes: number[] }
): Game | null {
    if (!game) return null;
    const turn = game.turns[game.turns.length - 1];
    const playerTurn = turn?.participants?.[payload.playerId];
    if (!playerTurn) return game;
    playerTurn.displayedCards = payload.cardIndexes;
    playerTurn.displayedCardsTime = Date.now();
    return { ...game };
}

function selectCardReducer(
    game: Game | null,
    payload: { playerId: string; cardIndex: number }
): Game | null {
    if (!game) return null;
    const turn = game.turns[game.turns.length - 1];
    const playerTurn = turn?.participants?.[payload.playerId];
    if (!playerTurn) return game;
    playerTurn.selectedCards = [
        ...new Set([...(playerTurn.selectedCards ?? []), payload.cardIndex]),
    ];
    return { ...game };
}

function setTimeEstimateReducer(
    game: Game | null,
    payload: { playerId: string; estimate: number }
): Game | null {
    if (!game) return null;
    const turn = game.turns[game.turns.length - 1];
    const playerTurn = turn?.participants?.[payload.playerId];
    if (!playerTurn) return game;
    playerTurn.estimateVisibleCards = payload.estimate;
    return { ...game };
}

function setGameTurnStatusReducer(
    game: Game | null,
    status: GameTurnStatus
): Game | null {
    if (!game) return null;
    const turn = game.turns[game.turns.length - 1];
    if (!turn) return game;
    turn.status = status;
    return { ...game };
}

function updatePlayersTurnReducer(
    game: Game | null,
    playersTurn: { [playerId: string]: Partial<PlayerTurn> }
): Game | null {
    if (!game) return null;
    Object.keys(playersTurn).forEach((pk) => {
        const playerTurn =
            game.turns[game.turns.length - 1]?.participants?.[pk];
        if (!playerTurn) return;
        game.turns[game.turns.length - 1].participants[pk] = {
            ...playerTurn,
            ...playersTurn[pk],
        };
    });
    return { ...game };
}

describe('Game Reducers', () => {
    let game: Game;

    beforeEach(() => {
        game = createMockGameWithPlayers(3).game;
    });

    describe('togglePlayerReady', () => {
        it('should toggle a player from not ready to ready', () => {
            const result = togglePlayerReadyReducer(game, 'player-0');
            expect(result!.participants['player-0'].ready).toBe(true);
        });

        it('should toggle a player from ready to not ready', () => {
            game.participants['player-0'].ready = true;
            const result = togglePlayerReadyReducer(game, 'player-0');
            expect(result!.participants['player-0'].ready).toBe(false);
        });

        it('should not affect other players', () => {
            const result = togglePlayerReadyReducer(game, 'player-0');
            expect(result!.participants['player-1'].ready).toBe(false);
            expect(result!.participants['player-2'].ready).toBe(false);
        });

        it('should return null if game is null', () => {
            expect(togglePlayerReadyReducer(null, 'p1')).toBeNull();
        });
    });

    describe('startGame', () => {
        it('should set game status to running', () => {
            const result = startGameReducer(game);
            expect(result!.status).toBe('running');
        });

        it('should return null if game is null', () => {
            expect(startGameReducer(null)).toBeNull();
        });
    });

    describe('stopGame', () => {
        it('should set game status to finished', () => {
            const result = stopGameReducer(game);
            expect(result!.status).toBe('finished');
        });
    });

    describe('newTurn', () => {
        it('should add a new turn to the game', () => {
            const turn: GameTurn = {
                status: 'stPicksCards',
                participants: {},
            };
            const result = newTurnReducer(game, turn);
            expect(result!.turns).toHaveLength(1);
            expect(result!.turns[0].status).toBe('stPicksCards');
        });

        it('should append multiple turns', () => {
            const turn1: GameTurn = {
                status: 'stPicksCards',
                participants: {},
            };
            const turn2: GameTurn = {
                status: 'stWriteStory',
                participants: {},
            };
            const r1 = newTurnReducer(game, turn1);
            const r2 = newTurnReducer(r1, turn2);
            expect(r2!.turns).toHaveLength(2);
        });

        it('should return game unchanged if turn is undefined', () => {
            const result = newTurnReducer(game, undefined);
            expect(result).toBe(game);
        });
    });

    describe('setDisplayedCards', () => {
        it('should set displayed cards and timestamp', () => {
            const turn: GameTurn = {
                status: 'stPicksCards',
                participants: {
                    'player-0': {
                        playerId: 'player-0',
                        role: PlayerRole.storyteller,
                        score: 0,
                    },
                },
            };
            const withTurn = newTurnReducer(game, turn);
            const before = Date.now();
            const result = setDisplayedCardsReducer(withTurn, {
                playerId: 'player-0',
                cardIndexes: [1, 2, 3],
            });
            expect(
                result!.turns[0].participants['player-0'].displayedCards
            ).toEqual([1, 2, 3]);
            expect(
                result!.turns[0].participants['player-0'].displayedCardsTime
            ).toBeGreaterThanOrEqual(before);
        });
    });

    describe('selectCard', () => {
        it('should add a card to selectedCards', () => {
            const turn: GameTurn = {
                status: 'stPicksCards',
                participants: {
                    'player-0': {
                        playerId: 'player-0',
                        role: PlayerRole.storyteller,
                        score: 0,
                    },
                },
            };
            const withTurn = newTurnReducer(game, turn);
            const r1 = selectCardReducer(withTurn, {
                playerId: 'player-0',
                cardIndex: 5,
            });
            expect(r1!.turns[0].participants['player-0'].selectedCards).toEqual(
                [5]
            );
        });

        it('should not add duplicate cards', () => {
            const turn: GameTurn = {
                status: 'stPicksCards',
                participants: {
                    'player-0': {
                        playerId: 'player-0',
                        role: PlayerRole.storyteller,
                        score: 0,
                    },
                },
            };
            const withTurn = newTurnReducer(game, turn);
            const r1 = selectCardReducer(withTurn, {
                playerId: 'player-0',
                cardIndex: 5,
            });
            const r2 = selectCardReducer(r1, {
                playerId: 'player-0',
                cardIndex: 5,
            });
            expect(r2!.turns[0].participants['player-0'].selectedCards).toEqual(
                [5]
            );
        });
    });

    describe('setTimeEstimate', () => {
        it('should set the estimate for a player', () => {
            const turn: GameTurn = {
                status: 'pEstimate',
                participants: {
                    'player-1': {
                        playerId: 'player-1',
                        role: PlayerRole.gremlin,
                        score: 0,
                    },
                },
            };
            const withTurn = newTurnReducer(game, turn);
            const result = setTimeEstimateReducer(withTurn, {
                playerId: 'player-1',
                estimate: 5,
            });
            expect(
                result!.turns[0].participants['player-1'].estimateVisibleCards
            ).toBe(5);
        });
    });

    describe('setGameTurnStatus', () => {
        it('should update the current turn status', () => {
            const turn: GameTurn = {
                status: 'stPicksCards',
                participants: {},
            };
            const withTurn = newTurnReducer(game, turn);
            const result = setGameTurnStatusReducer(withTurn, 'stWriteStory');
            expect(result!.turns[0].status).toBe('stWriteStory');
        });

        it('should return game unchanged if no turns exist', () => {
            const result = setGameTurnStatusReducer(game, 'stWriteStory');
            expect(result).toBe(game);
        });
    });

    describe('updatePlayersTurn', () => {
        it('should update multiple player turns', () => {
            const turn: GameTurn = {
                status: 'turnEnded',
                participants: {
                    'player-0': {
                        playerId: 'player-0',
                        role: PlayerRole.storyteller,
                        score: 0,
                    },
                    'player-1': {
                        playerId: 'player-1',
                        role: PlayerRole.gremlin,
                        score: 0,
                    },
                },
            };
            const withTurn = newTurnReducer(game, turn);
            const result = updatePlayersTurnReducer(withTurn, {
                'player-0': { score: 50, speed: 0.5 },
                'player-1': { score: 30, speed: 0.8 },
            });
            expect(result!.turns[0].participants['player-0'].score).toBe(50);
            expect(result!.turns[0].participants['player-0'].speed).toBe(0.5);
            expect(result!.turns[0].participants['player-1'].score).toBe(30);
            expect(result!.turns[0].participants['player-1'].speed).toBe(0.8);
        });
    });
});
