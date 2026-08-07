import { Game, Player } from '../types';

/**
 * Create a minimal mock game state for testing.
 */
export function createMockGame(overrides: Partial<Game> = {}): Game {
    return {
        id: 'test-game-id',
        participants: {},
        turns: [],
        createdAt: Date.now(),
        status: 'lobby',
        peerId: 'test-peer-id',
        ...overrides,
    };
}

/**
 * Create a mock player.
 */
export function createMockPlayer(
    id: string,
    overrides: Partial<Player> = {}
): Player {
    return {
        id,
        name: `Player ${id}`,
        ready: false,
        ...overrides,
    };
}

/**
 * Create a mock game with N players in lobby state.
 */
export function createMockGameWithPlayers(playerCount: number): {
    game: Game;
    players: Player[];
} {
    const players: Player[] = [];
    for (let i = 0; i < playerCount; i++) {
        players.push(createMockPlayer(`player-${i}`));
    }
    const game = createMockGame({
        participants: players.reduce(
            (acc, p) => {
                acc[p.id] = p;
                return acc;
            },
            {} as { [participantId: string]: Player }
        ),
    });
    return { game, players };
}
