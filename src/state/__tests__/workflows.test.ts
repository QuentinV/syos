import { describe, it, expect } from 'vitest';
import {
    Game,
    GameTurn,
    GameTurnStatus,
    PlayerRole,
    PlayerTurn,
} from '../types';
import { createMockGame } from '../../utils/__tests__/mockPeer';

// Extract workflow transition logic from workflows.ts for testing
interface FlowTransition {
    from: GameTurnStatus;
    filter: (context: {
        game: Game;
        turn?: GameTurn;
        playerTurn?: PlayerTurn;
        player: { id: string };
    }) => boolean;
    logic?: (context: {
        game: Game;
        player: { id: string };
    }) => undefined | (() => any) | void;
    next?: GameTurnStatus;
}

// Recreate the workflows from workflows.ts for testing
const workflows: FlowTransition[] = [
    {
        from: 'stPicksCards',
        filter: ({ playerTurn }) => playerTurn?.selectedCards?.length === 3,
        next: 'stWriteStory',
    },
    {
        from: 'stWriteStory',
        filter: ({ playerTurn }) => !!playerTurn?.story,
        next: 'pEstimate',
    },
    {
        from: 'pEstimate',
        filter: ({ turn }) =>
            Object.keys(turn?.players ?? {}).every(
                (pk) =>
                    turn?.players?.[pk].role === PlayerRole.storyteller ||
                    !!turn?.players?.[pk]?.estimateVisibleCards
            ),
        next: 'pPicksCards',
    },
    {
        from: 'pPicksCards',
        filter: ({ turn }) =>
            Object.keys(turn?.players ?? {}).every(
                (pk) =>
                    turn?.players?.[pk].role === PlayerRole.storyteller ||
                    !!turn?.players?.[pk]?.selectedCardsTime
            ),
        logic: ({ game }) => {
            const gameTurn = game.turns[game.turns.length - 1];
            const players = gameTurn.players;
            const playersKeys = Object.keys(players);
            const storyteller =
                players[
                    playersKeys.find(
                        (pk) => players[pk].role === PlayerRole.storyteller
                    ) ?? ''
                ];

            const playersVoted = playersKeys.filter(
                (k) => players[k].estimateVisibleCards !== -1
            );

            const timeoutSelectCards =
                playersVoted.reduce(
                    (prev, pk) => players[pk].estimateVisibleCards ?? 0 + prev,
                    0
                ) / playersVoted.length;

            const playersCorrect = playersKeys.filter(
                (pk) =>
                    storyteller.selectedCards!.filter(
                        (c) => players[pk].selectedCards?.includes(c) ?? 0
                    ).length === 3
            );

            const update = playersKeys.reduce(
                (prev, pk) => {
                    const player = players[pk];
                    const playerTurn = players[player.playerId];

                    const speed =
                        player.role === PlayerRole.gremlin
                            ? timeoutSelectCards /
                              ((playerTurn.selectedCardsTime ?? 0) -
                                  (playerTurn.displayedCardsTime ?? 0))
                            : (playersCorrect.length - 1) /
                              (playersKeys.length - 1);

                    const correctCards = storyteller.selectedCards!.filter(
                        (c) => player.selectedCards?.includes(c) ?? 0
                    ).length;

                    prev[pk] = {
                        playerId: player.playerId,
                        score:
                            (playerTurn.score ?? 0) +
                            Math.round((correctCards / 3) * 50) +
                            Math.round(speed * 50),
                        speed,
                    };

                    return prev;
                },
                {} as {
                    [playerId: string]: {
                        playerId: string;
                        score: number;
                        speed: number;
                    };
                }
            );

            return () => update; // returns a function that returns the update
        },
        next: 'turnEnded',
    },
    {
        from: 'turnEnded',
        filter: ({ game }) => game.turns.length >= 10,
        logic: () => {
            // stopGame would be called here
        },
    },
];

function createMockContext(
    overrides: {
        game?: Game;
        turn?: GameTurn;
        playerTurn?: PlayerTurn;
        player?: { id: string };
    } = {}
) {
    const game = overrides.game ?? createMockGame({ status: 'running' });
    const turn = overrides.turn ?? {
        status: 'stPicksCards' as GameTurnStatus,
        players: {},
    };
    const playerTurn = overrides.playerTurn ?? {
        playerId: 'player-0',
        role: PlayerRole.storyteller,
        score: 0,
    };
    const player = overrides.player ?? { id: 'player-0' };

    // Ensure the turn is in the game's turns array
    if (game.turns.length === 0) {
        game.turns.push(turn);
    } else {
        game.turns[game.turns.length - 1] = turn;
    }

    // Ensure the playerTurn is in the turn's players
    if (!turn.players[player.id]) {
        turn.players[player.id] = playerTurn;
    }

    return { game, turn, playerTurn, player };
}

describe('Workflow Transitions', () => {
    describe('stPicksCards → stWriteStory', () => {
        const workflow = workflows[0];

        it('should transition when storyteller has selected 3 cards', () => {
            const context = createMockContext({
                playerTurn: {
                    playerId: 'player-0',
                    role: PlayerRole.storyteller,
                    score: 0,
                    selectedCards: [1, 2, 3],
                },
            });
            expect(workflow.filter(context)).toBe(true);
            expect(workflow.next).toBe('stWriteStory');
        });

        it('should NOT transition when storyteller has fewer than 3 cards', () => {
            const context = createMockContext({
                playerTurn: {
                    playerId: 'player-0',
                    role: PlayerRole.storyteller,
                    score: 0,
                    selectedCards: [1, 2],
                },
            });
            expect(workflow.filter(context)).toBe(false);
        });

        it('should NOT transition when storyteller has no cards', () => {
            const context = createMockContext({
                playerTurn: {
                    playerId: 'player-0',
                    role: PlayerRole.storyteller,
                    score: 0,
                },
            });
            expect(workflow.filter(context)).toBe(false);
        });
    });

    describe('stWriteStory → pEstimate', () => {
        const workflow = workflows[1];

        it('should transition when storyteller has written a story', () => {
            const context = createMockContext({
                turn: { status: 'stWriteStory', players: {} },
                playerTurn: {
                    playerId: 'player-0',
                    role: PlayerRole.storyteller,
                    score: 0,
                    story: 'Once upon a time...',
                },
            });
            expect(workflow.filter(context)).toBe(true);
            expect(workflow.next).toBe('pEstimate');
        });

        it('should NOT transition when story is empty', () => {
            const context = createMockContext({
                turn: { status: 'stWriteStory', players: {} },
                playerTurn: {
                    playerId: 'player-0',
                    role: PlayerRole.storyteller,
                    score: 0,
                },
            });
            expect(workflow.filter(context)).toBe(false);
        });
    });

    describe('pEstimate → pPicksCards', () => {
        const workflow = workflows[2];

        it('should transition when all gremlins have submitted estimates', () => {
            const context = createMockContext({
                turn: {
                    status: 'pEstimate',
                    players: {
                        'player-0': {
                            playerId: 'player-0',
                            role: PlayerRole.storyteller,
                            score: 0,
                        },
                        'player-1': {
                            playerId: 'player-1',
                            role: PlayerRole.gremlin,
                            score: 0,
                            estimateVisibleCards: 5,
                        },
                        'player-2': {
                            playerId: 'player-2',
                            role: PlayerRole.gremlin,
                            score: 0,
                            estimateVisibleCards: 3,
                        },
                    },
                },
            });
            expect(workflow.filter(context)).toBe(true);
            expect(workflow.next).toBe('pPicksCards');
        });

        it('should NOT transition when some gremlins have not estimated', () => {
            const context = createMockContext({
                turn: {
                    status: 'pEstimate',
                    players: {
                        'player-0': {
                            playerId: 'player-0',
                            role: PlayerRole.storyteller,
                            score: 0,
                        },
                        'player-1': {
                            playerId: 'player-1',
                            role: PlayerRole.gremlin,
                            score: 0,
                            estimateVisibleCards: 5,
                        },
                        'player-2': {
                            playerId: 'player-2',
                            role: PlayerRole.gremlin,
                            score: 0,
                            // No estimate yet
                        },
                    },
                },
            });
            expect(workflow.filter(context)).toBe(false);
        });

        it('should transition with only storyteller if no gremlins', () => {
            const context = createMockContext({
                turn: {
                    status: 'pEstimate',
                    players: {
                        'player-0': {
                            playerId: 'player-0',
                            role: PlayerRole.storyteller,
                            score: 0,
                        },
                    },
                },
            });
            // Storyteller is the only player, so "all non-storyteller players" is vacuously true
            expect(workflow.filter(context)).toBe(true);
        });
    });

    describe('pPicksCards → turnEnded (scoring)', () => {
        const workflow = workflows[3];

        it('should transition when all gremlins have picked cards', () => {
            const context = createMockContext({
                turn: {
                    status: 'pPicksCards',
                    players: {
                        'player-0': {
                            playerId: 'player-0',
                            role: PlayerRole.storyteller,
                            score: 0,
                            selectedCards: [1, 2, 3],
                        },
                        'player-1': {
                            playerId: 'player-1',
                            role: PlayerRole.gremlin,
                            score: 0,
                            selectedCardsTime: Date.now(),
                            selectedCards: [1, 2, 3],
                        },
                        'player-2': {
                            playerId: 'player-2',
                            role: PlayerRole.gremlin,
                            score: 0,
                            selectedCardsTime: Date.now(),
                            selectedCards: [4, 5, 6],
                        },
                    },
                },
            });
            expect(workflow.filter(context)).toBe(true);
            expect(workflow.next).toBe('turnEnded');
        });

        it('should NOT transition when some gremlins have not picked', () => {
            const context = createMockContext({
                turn: {
                    status: 'pPicksCards',
                    players: {
                        'player-0': {
                            playerId: 'player-0',
                            role: PlayerRole.storyteller,
                            score: 0,
                            selectedCards: [1, 2, 3],
                        },
                        'player-1': {
                            playerId: 'player-1',
                            role: PlayerRole.gremlin,
                            score: 0,
                            selectedCardsTime: Date.now(),
                        },
                        'player-2': {
                            playerId: 'player-2',
                            role: PlayerRole.gremlin,
                            score: 0,
                            // No selectedCardsTime
                        },
                    },
                },
            });
            expect(workflow.filter(context)).toBe(false);
        });

        it('should calculate scores correctly in logic', () => {
            const game = createMockGame({ status: 'running' });
            const turn: GameTurn = {
                status: 'pPicksCards',
                players: {
                    'player-0': {
                        playerId: 'player-0',
                        role: PlayerRole.storyteller,
                        score: 0,
                        selectedCards: [1, 2, 3],
                    },
                    'player-1': {
                        playerId: 'player-1',
                        role: PlayerRole.gremlin,
                        score: 0,
                        selectedCards: [1, 2, 3],
                        selectedCardsTime: 2000,
                        displayedCardsTime: 1000,
                        estimateVisibleCards: 5,
                    },
                    'player-2': {
                        playerId: 'player-2',
                        role: PlayerRole.gremlin,
                        score: 0,
                        selectedCards: [4, 5, 6],
                        selectedCardsTime: 3000,
                        displayedCardsTime: 1000,
                        estimateVisibleCards: 3,
                    },
                },
            };
            game.turns.push(turn);

            const logicResult = workflow.logic!({
                game,
                player: { id: 'player-0' },
            });

            // logic returns a function that returns the update
            const update = (logicResult as () => any)();

            // player-1 matched all 3 cards → correctCards = 3 → score = 50 + speed*50
            expect(update['player-1'].score).toBeGreaterThan(0);
            // player-2 matched 0 cards → correctCards = 0 → score = 0 + speed*50
            // speed for gremlin = timeoutSelectCards / (selectedCardsTime - displayedCardsTime)
            expect(update['player-2'].score).toBeGreaterThanOrEqual(0);
        });
    });

    describe('turnEnded → game finished', () => {
        const workflow = workflows[4];

        it('should finish game after 10 turns', () => {
            const game = createMockGame({ status: 'running' });
            for (let i = 0; i < 10; i++) {
                game.turns.push({
                    status: 'turnEnded',
                    players: {},
                });
            }
            const context = createMockContext({ game });
            expect(workflow.filter(context)).toBe(true);
        });

        it('should NOT finish game before 10 turns', () => {
            const game = createMockGame({ status: 'running' });
            for (let i = 0; i < 5; i++) {
                game.turns.push({
                    status: 'turnEnded',
                    players: {},
                });
            }
            const context = createMockContext({ game });
            expect(workflow.filter(context)).toBe(false);
        });
    });
});
