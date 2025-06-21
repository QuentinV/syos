import { useUnit } from 'effector-react';
import { $game, useGame } from './game';
import { $player } from './player';
import { GameTurn, Player, PlayerTurn } from './types';

export const useGameTurnStatus = () => {
    const game = useGame();
    return game?.turns?.[game?.turns?.length - 1]?.status ?? null;
};

export const usePlayerTurn = (): PlayerTurn | undefined => {
    const turn = useTurn();
    const player = useUnit($player);
    return turn?.players?.[player?.id ?? ''];
};

export const useStorytellerTurn = (): PlayerTurn | undefined => {
    const turn = useTurn();
    return turn?.players
        ? turn.players[
              Object.keys(turn.players).find(
                  (key) => turn.players[key].role === 'storyteller'
              ) ?? ''
          ]
        : undefined;
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
    if (!turn) return;
    return turn.players[
        Object.keys(turn.players).find(
            (k) => turn.players[k].role === 'storyteller'
        ) ?? ''
    ].story;
};

export interface ExtendedPlayerTurn extends PlayerTurn {
    player?: Player;
}

export const usePlayersTurn = (): ExtendedPlayerTurn[] => {
    const game = useUnit($game);
    const turn = useTurn();
    return !turn
        ? []
        : Object.keys(turn.players).map((k) => ({
              ...turn.players[k],
              player: game?.players?.[turn.players[k]?.playerId],
          }));
};
