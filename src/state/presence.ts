import { $game, updateGame } from './game';

const TIMEOUT = 8000;

export const startPresenceCheck = () => {
    setInterval(() => {
        const game = $game.getState();
        if (!game) return;

        const now = Date.now();

        let changed = false;

        const newPlayers = { ...game.players };

        for (const id of Object.keys(newPlayers)) {
            const player = newPlayers[id];

            if (now - (player.lastSeen ?? 0) > TIMEOUT) {
                delete newPlayers[id];
                changed = true;
            }
        }

        if (changed) {
            updateGame({ ...game, players: newPlayers });
        }
    }, 3000);
};
