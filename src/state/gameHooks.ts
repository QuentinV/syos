import { useUnit } from 'effector-react';
import {
    useParticipantTurn as useChorusParticipantTurn,
    usePreviousTurn as useChorusPreviousTurn,
    useTurn as useChorusTurn,
    useTurnParticipantByPredicate as useChorusTurnParticipantByPredicate,
    useTurnParticipants as useChorusTurnParticipants,
    useTurnStatus as useChorusTurnStatus,
} from '../chorus';
import { $game } from './game';
import { $participant } from './player';
import {
    GameTurn,
    GameTurnStatus,
    Player,
    PlayerRole,
    PlayerTurn,
} from './types';

export const useGameTurnStatus = () => useChorusTurnStatus<GameTurnStatus>();

export const usePlayerTurn = (): PlayerTurn | undefined => {
    const participant = useUnit($participant);
    return useChorusParticipantTurn<PlayerTurn>(participant?.id ?? '');
};

export const useStorytellerTurn = (): PlayerTurn | undefined =>
    useChorusTurnParticipantByPredicate<PlayerTurn>(
        (p) => p.role === PlayerRole.storyteller
    );

export const useTurn = (): GameTurn | undefined =>
    useChorusTurn<GameTurnStatus, PlayerTurn>();

export const usePreviousTurn = (): GameTurn | undefined =>
    useChorusPreviousTurn<GameTurnStatus, PlayerTurn>();

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
    const participants = useChorusTurnParticipants<PlayerTurn>();
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
