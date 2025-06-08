import { createEffect, createEvent, createStore, sample } from 'effector';
import { Game, getGame, saveGame } from '../api/game';

export const $game = createStore<Game | null>(null);
export const initGame = createEvent<string>();
export const updateGame = createEvent<Game>();
export const setPeerId = createEvent<string>();
export const togglePlayerReady = createEvent<string>();
export const startGame = createEvent<void>();

export const loadGameFromStorageFx = createEffect(
    async ({ id }: { id: string }) => {
        const game = await getGame(id);
        return game ?? null;
    }
);

$game
    .on(loadGameFromStorageFx.doneData, (_, state) => state)
    .on(updateGame, (_, state) => ({ ...state }))
    .on(setPeerId, (game, peerId) => (game ? { ...game, peerId } : null))
    .on(togglePlayerReady, (game, playerId) => {
        if (!game) return null;
        game.players[playerId].ready = !game.players[playerId].ready;
        return { ...game };
    })
    .on(startGame, (game) => (game ? { ...game, status: 'running' } : null));

sample({
    source: $game,
    target: createEffect(saveGame),
});
