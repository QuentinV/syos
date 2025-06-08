import { $game } from '../state/game';
import { Game, Player, saveGame } from './game';

export const rtcActions: any = {
    joinGame: (mess: { player: Player; playerId: string }) => {
        const game = $game.getState();
        if (!game) {
            console.log('ERROR GAME NOT FOUND');
            return;
        }
        game.players[mess.playerId] = mess.player;
        saveGame(game);
        return $game.getState();
    },
    joinGame_answer: async (game: Game) => {
        await saveGame(game);
        location.href = `http://localhost:3000/syos#/game/${game.id}`;
    },
};
