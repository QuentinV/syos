import { useUnit } from 'effector-react';
import { $game } from './game';
import { $player } from './player';
import { PlayerTurn } from '../api/game';

export const usePlayerTurn = (): PlayerTurn | undefined => {
    const game = useUnit($game);
    const player = useUnit($player);
    const turn = game?.turns?.[game?.turns?.length - 1];
    return turn?.players?.[player?.id ?? ''];
};
