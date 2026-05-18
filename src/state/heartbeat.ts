import { createEvent, sample } from 'effector';
import { $player } from './player';
import { heartbeat } from './game';

export const tick = createEvent<void>();

sample({
    clock: tick,
    source: $player,
    filter: Boolean,
    fn: (player) => ({
        playerId: player.id,
    }),
    target: heartbeat,
});
