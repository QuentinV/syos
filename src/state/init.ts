import { createEffect, sample, attach } from 'effector';
import './workflows';
import { $game, $participant, gameEvents } from './game';
import { v4 as uuid } from 'uuid';
import {
    Game,
    GameParticipantsTurn,
    GameTurn,
    Player,
    PlayerRole,
} from './types';

export const newGameFx = attach({
    source: { $participant },
    effect: createEffect(
        ({ $participant }: { $participant: Player | null }) => {
            const id = uuid();
            const game: Game = {
                id,
                createdAt: new Date().getTime(),
                status: 'lobby',
                participants: {},
                turns: [],
            };
            if ($participant) {
                game.participants = { [$participant.id]: $participant };
            }
            return game;
        }
    ),
});

export const newTurnFx = attach({
    source: $game,
    effect: createEffect((game: Game | null): GameTurn | undefined => {
        if (!game) return;
        const pkeys = Object.keys(game.participants);
        const randomIndex = Math.floor(Math.random() * pkeys.length);
        const turn: GameTurn = {
            status: 'stPicksCards',
            participants: Object.keys(game.participants).reduce(
                (prev, pkey, i) => {
                    const previousScore =
                        game.turns[game.turns.length - 1]?.participants?.[pkey]
                            ?.score ?? 0;

                    prev[pkey] = {
                        playerId: pkey,
                        score: previousScore,
                        role:
                            randomIndex === i
                                ? PlayerRole.storyteller
                                : PlayerRole.gremlin,
                    };
                    return prev;
                },
                {} as GameParticipantsTurn
            ),
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

// When a joiner is added to the session, redirect them to the game page.
// The auto-join itself is handled generically by the chorus turn layer.
sample({
    clock: gameEvents.joinParticipant,
    target: createEffect(() => {
        const gameId = $game.getState()?.id;
        if (gameId) {
            location.href = `${document.location.origin}/syos#/game/${gameId}`;
        }
    }),
});
