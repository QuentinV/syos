import { Participant, SessionStatus, Turn, TurnSessionState } from '../chorus';

export type { Participant as Player };

export interface Game extends TurnSessionState<GameTurnStatus, PlayerTurn> {
    peerId?: string;
}

export type GameParticipantsTurn = { [participantId: string]: PlayerTurn };

export type GameStatus = SessionStatus;

export type GameTurn = Turn<GameTurnStatus, PlayerTurn>;

export type GameTurnStatus =
    'stPicksCards' | 'stWriteStory' | 'pEstimate' | 'pPicksCards' | 'turnEnded';

export enum PlayerRole {
    storyteller = 'storyteller',
    gremlin = 'gremlin',
}

export interface PlayerTurn {
    playerId: string;
    role?: PlayerRole;
    story?: string;
    selectedCards?: number[];
    displayedCards?: number[];
    score?: number;
    estimateVisibleCards?: number;
    displayedCardsTime?: number;
    selectedCardsTime?: number;
    speed?: number;
}
