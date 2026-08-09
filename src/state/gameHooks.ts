import { useUnit } from 'effector-react';
import { $game } from './game';
import { Player, PlayerRole, PlayerTurn } from './types';
import {
    usePreviousTurn,
    useTurnParticipantByPredicate,
    useTurnParticipants,
} from '@quentinv/chorus';

export const useStorytellerTurn = (): PlayerTurn | undefined =>
    useTurnParticipantByPredicate((p) => p.role === PlayerRole.storyteller);

export const usePreviousStory = (): string | undefined => {
    const turn = usePreviousTurn();
    if (!turn) return;
    return turn.participants[
        Object.keys(turn.participants).find(
            (k) => turn.participants[k].role === PlayerRole.storyteller
        ) ?? ''
    ].story;
};

export interface ExtendedPlayerTurn extends PlayerTurn {
    player?: Player;
}

export const usePlayersTurn = (): ExtendedPlayerTurn[] => {
    const game = useUnit($game);
    const participants = useTurnParticipants();
    return Object.keys(participants).map((k) => ({
        ...participants[k],
        player: game?.participants?.[participants[k]?.playerId],
    }));
};

export const useValidCards = (): number[] => {
    const players = usePlayersTurn();
    const storyteller = players.find((p) => p.role === PlayerRole.storyteller);
    return storyteller?.selectedCards ?? [];
};
