export interface Game {
    id: string;
    players: { [playerId: string]: Player };
    turns: GameTurn[];
    createdAt: Date;
    peerId?: string;
    status: GameStatus;
}

export interface Player {
    id: string;
    name: string;
    ready: boolean;
}

export interface GameTurn {
    status: GameTurnStatus;
    players: GamePlayersTurn;
    timeoutPlayerSelectCards?: number;
}

export type GamePlayersTurn = { [playerId: string]: PlayerTurn };

export type GameStatus = 'lobby' | 'running' | 'finished';

export type GameTurnStatus =
    | 'stPicksCards'
    | 'stWriteStory'
    | 'pEstimate'
    | 'pPicksCards'
    | 'waitForPlayers'
    | 'turnEnded';

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
    displayedCardsTime?: Date;
    selectedCardsTime?: Date;
}
