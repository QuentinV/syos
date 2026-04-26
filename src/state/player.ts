import { createEffect, createEvent, createStore, sample } from 'effector';
import { Player } from './types';
import { v4 as uuid } from 'uuid';

export const $player = createStore<Player | null>(null);
export const setPlayerName = createEvent<string>();

const reloadFromStorageFx = createEffect(() => {
    const playerStr = localStorage.getItem('player');
    return playerStr
        ? (JSON.parse(playerStr) as Player)
        : {
              id: uuid(),
              name: 'Player ' + Math.floor(Math.random() * 1000),
              ready: true,
          };
});

const savePlayerFx = createEffect((player: Player) => {
    localStorage.setItem('player', JSON.stringify(player));
});

$player
    .on(setPlayerName, (player, name) => (player ? { ...player, name } : null))
    .on(reloadFromStorageFx.doneData, (_, player) => player);

sample({
    source: $player,
    filter: (player) => !!player,
    target: savePlayerFx,
});

reloadFromStorageFx();
