import { useUnit } from 'effector-react';
import { $game, useGame } from './game';
import { $participant } from './player';
import { GameTurn, Player, PlayerRole, PlayerTurn } from './types';

export const useGameTurnStatus = () => {
    const game = useGame();
    return game?.turns?.[game?.turns?.length - 1]?.status ?? null;
};

export const usePlayerTurn = (): PlayerTurn | undefined => {
    const turn = useTurn();
    const participant = useUnit($participant);
    return turn?.participants?.[participant?.id ?? ''];
};

export const useStorytellerTurn = (): PlayerTurn | undefined => {
    const turn = useTurn();
    return turn?.participants
        ? turn.participants[
              Object.keys(turn.participants).find(
                  (key) => turn.participants[key].role === 'storyteller'
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
    return turn.participants[
        Object.keys(turn.participants).find(
            (k) => turn.participants[k].role === 'storyteller'
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
        : Object.keys(turn.participants).map((k) => ({
              ...turn.participants[k],
              player: game?.participants?.[turn.participants[k]?.playerId],
          }));
};

export const useValidCards = (): number[] => {
    const players = usePlayersTurn();
    const storyteller = players.find((p) => p.role === PlayerRole.storyteller);
    return storyteller?.selectedCards ?? [];
};
