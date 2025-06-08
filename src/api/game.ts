import { get, getAll, put } from './db';
import { v4 as uuid } from 'uuid';

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
    players: { [playerId: string]: PlayerTurn };
}

export interface PlayerTurn {
    playerId: string;
    role: 'storyteller' | 'gremlin';
    story: string;
    selectedCards: string[];
    score: number;
}

export const listGames = () => getAll({ storeName: 'games' });

export const newGame = async ({ player }: { player: Player }) => {
    const id = uuid();
    await put({
        storeName: 'games',
        data: {
            id,
            createdAt: new Date(),
            status: 'lobby',
            players: { [player.id]: player },
            turns: [],
        },
    });
    return id;
};

export const getGame = (id: string): Promise<Game> =>
    get({ storeName: 'games', id });

export const saveGame = async (game: Game | null) => {
    if (!game) return;
    await put({
        storeName: 'games',
        data: {
            ...game,
            updatedAt: new Date(),
        },
    });
};
