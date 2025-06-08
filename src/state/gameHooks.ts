import { useUnit } from 'effector-react';
import { $game } from './game';
import { $player } from './player';
import { GameTurn, PlayerTurn } from '../api/game';

export const usePlayerTurn = (): PlayerTurn | undefined => {
    const turn = useTurn();
    const player = useUnit($player);
    return turn?.players?.[player?.id ?? ''];
};

export const useTurn = (): GameTurn | undefined => {
    const game = useUnit($game);
    return game?.turns?.[game?.turns?.length - 1];
};

export const usePreviousTurn = (): GameTurn | undefined => {
    const game = useUnit($game);
    return game?.turns?.[game?.turns?.length - 2];
};

export const usePreviousStory = (): string | undefined => {
    const turn = usePreviousTurn();
    return '';
};
