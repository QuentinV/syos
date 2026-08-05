import { createEffect, sample, attach } from 'effector';
import './workflows';
import { $game, gameEvents, joinFx } from './game';
import { $participant } from './player';
import { v4 as uuid } from 'uuid';
import { Game, GamePlayersTurn, GameTurn, Player, PlayerRole } from './types';

export const newGameFx = attach({
    source: { $participant },
    effect: createEffect(
        ({ $participant }: { $participant: Player | null }) => {
            const id = uuid();
            const game: Game = {
                id,
                createdAt: new Date().getTime(),
                status: 'lobby',
                players: {},
                turns: [],
            };
            if ($participant) {
                game.players = { [$participant.id]: $participant };
            }
            return game;
        }
    ),
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
    target: gameEvents.updateState,
});

sample({
    source: newTurnFx.doneData,
    target: gameEvents.addTurn,
});

sample({
    source: gameEvents.startSession,
    target: newTurnFx,
});

sample({
    clock: $game,
    source: $participant,
    filter: (participant, game) => {
        return (
            game !== null &&
            participant !== null &&
            !game.players[participant.id]
        );
    },
    fn: (participant, game) => ({ participant, gameId: game!.id }),
    target: createEffect(
        ({
            participant,
            gameId,
        }: {
            participant: Player | null;
            gameId: string;
        }) => {
            if (participant) {
                gameEvents.joinParticipant(participant);
            }
            location.href = `${document.location.origin}/syos#/game/${gameId}`;
        }
    ),
});
