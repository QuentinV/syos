import { createEffect, sample, attach, createEvent } from 'effector';
import './workflows';
import { $game, gameDS, joinFx, newTurn, startGame, updateGame } from './game';
import { $player } from './player';
import { v4 as uuid } from 'uuid';
import { Game, GamePlayersTurn, GameTurn, Player, PlayerRole } from './types';

export const navigateToGame = createEvent<string>();

export const newGameFx = attach({
    source: $player,
    effect: createEffect((player: Player | null) => {
        const id = uuid();
        const game: Game = {
            id,
            createdAt: Date.now(),
            status: 'lobby',
            players: {},
            turns: [],
        };

        if (player) {
            game.players[player.id] = player;
        }

        return game;
    }),
});

export const newTurnFx = attach({
    source: $game,
    effect: createEffect((game: Game | null): GameTurn | undefined => {
        if (!game) return;
        const pkeys = Object.keys(game.players);
        const randomIndex = Math.floor(Math.random() * pkeys.length);
        const turn: GameTurn = {
            status: 'stPicksCards',
            players: Object.keys(game.players).reduce((prev, pkey, i) => {
                const previousScore =
                    game.turns[game.turns.length - 1]?.players?.[pkey]?.score ??
                    0;

                prev[pkey] = {
                    playerId: pkey,
                    score: previousScore,
                    role:
                        randomIndex === i
                            ? PlayerRole.storyteller
                            : PlayerRole.gremlin,
                };
                return prev;
            }, {} as GamePlayersTurn),
        };
        return turn;
    }),
});

sample({
    source: newGameFx.doneData,
    target: updateGame,
});

sample({
    source: newTurnFx.doneData,
    target: newTurn,
});

sample({
    source: startGame,
    target: newTurnFx,
});

const joined = createEvent<Player | null>();
gameDS.on('joined', joined, (game, player: Player | null) => {
    if (!game || !player) {
        return;
    }
    game.players[player.id] = player;
    return { ...game };
});

sample({
    clock: joinFx.doneData,
    fn: (gameId) => gameId!,
    target: navigateToGame,
});
