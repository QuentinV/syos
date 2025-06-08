import { createEffect, createEvent, createStore } from 'effector';
import { Game, getGame } from '../api/game';

export const $game = createStore<Game | null>(null);
export const initGame = createEvent<string>();
export const updateGame = createEvent<Game>();
export const setPeerId = createEvent<string>();

export const loadGameFromStorageFx = createEffect(
    async ({ id }: { id: string }) => {
        const game = await getGame(id);
        return game ?? null;
    }
);

$game
    .on(loadGameFromStorageFx.doneData, (_, state) => state)
    .on(updateGame, (_, state) => ({ ...state }))
    .on(setPeerId, (game, peerId) => (game ? { ...game, peerId } : null));
