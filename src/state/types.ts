export interface Game {
    id: string;
    players: { [playerId: string]: Player };
    turns: GameTurn[];
    createdAt: Date;
    peerId?: string;
    status: 'lobby' | 'running' | 'finished';
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

export type GameTurnStatus =
    | 'stPicksCards'
    | 'stWriteStory'
    | 'pEstimate'
    | 'pPicksCards'
    | 'waitForPlayers'
    | 'turnEnded';

export interface PlayerTurn {
    playerId: string;
    role?: 'storyteller' | 'gremlin';
    story?: string;
    selectedCards?: number[];
    displayedCards?: number[];
    score?: number;
    estimateSelectTime?: Date;
    displayedCardsTime?: Date;
    selectedCardsTime?: Date;
}
