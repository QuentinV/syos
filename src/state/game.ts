import {
    attach,
    createEffect,
    createEvent,
    createStore,
    sample,
} from 'effector';
import {
    Game,
    GameTurnStatus,
    getGame,
    Player,
    PlayerTurn,
    saveGame,
} from '../api/game';

export const $game = createStore<Game | null>(null);
export const $gameTurnStatus = createStore<GameTurnStatus | null>(null);

export const initGame = createEvent<string>();
export const updateGame = createEvent<Game>();
export const setPeerId = createEvent<string>();
export const togglePlayerReady = createEvent<string>();
export const startGame = createEvent<void>();
export const newTurn = createEvent<void>();
export const newPlayerTurn = createEvent<Player>();
export const setDisplayedCards = createEvent<{
    playerId: string;
    cardIndexes: number[];
}>();
export const selectCard = createEvent<{
    playerId: string;
    cardIndex: number;
}>();
export const setGameTurnStatus = createEvent<GameTurnStatus>();
export const writeStory = createEvent<{ playerId: string; story: string }>();

export const loadGameFromStorageFx = createEffect(
    async ({ id }: { id: string }) => {
        const game = await getGame(id);
        return game ?? null;
    }
);

const updatePlayerTurn = (
    game: Game | null,
    playerId: string,
    update: (turn: PlayerTurn) => void
) => {
    if (!game) return null;
    const playerTurn =
        game?.turns?.[game?.turns?.length - 1]?.players?.[playerId];
    if (!playerTurn) return game;
    update(playerTurn);
    return { ...game };
};

$game
    .on(loadGameFromStorageFx.doneData, (_, state) => state)
    .on(updateGame, (_, state) => ({ ...state }))
    .on(setPeerId, (game, peerId) => (game ? { ...game, peerId } : null))
    .on(togglePlayerReady, (game, playerId) => {
        if (!game) return null;
        game.players[playerId].ready = !game.players[playerId].ready;
        return { ...game };
    })
    .on(startGame, (game) => (game ? { ...game, status: 'running' } : null))
    .on(newTurn, (game) =>
        game
            ? {
                  ...game,
                  turns: [
                      ...game.turns,
                      { status: 'stPicksCards', players: {} },
                  ],
              }
            : null
    )
    .on(newPlayerTurn, (game, player) => {
        if (!game) return null;
        if (game.turns[game.turns.length - 1]?.players?.[player.id])
            return game;
        const turn = game.turns[game.turns.length - 1];
        turn.players[player.id] = {
            playerId: player.id,
            role: Object.keys(turn.players).some(
                (k) => turn.players[k].role === 'storyteller'
            )
                ? 'gremlin'
                : 'storyteller',
            score: 0,
        };
        return { ...game };
    })
    .on(setDisplayedCards, (game, state) =>
        updatePlayerTurn(game, state.playerId, (playerTurn) => {
            playerTurn.displayedCards = state.cardIndexes;
        })
    )
    .on(selectCard, (game, state) =>
        updatePlayerTurn(game, state.playerId, (playerTurn) => {
            playerTurn.selectedCards = [
                ...new Set([
                    ...(playerTurn.selectedCards ?? []),
                    state.cardIndex,
                ]),
            ];
        })
    )
    .on(setGameTurnStatus, (game, status) => {
        if (!game) return null;
        const turn = game?.turns?.[game?.turns?.length - 1];
        if (!turn) return game;
        turn.status = status;
        return { ...game };
    })
    .on(writeStory, (game, state) =>
        updatePlayerTurn(game, state.playerId, (playerTurn) => {
            playerTurn.story = state.story;
        })
    );

$gameTurnStatus.on(
    $game.updates,
    (_, game) => game?.turns?.[game?.turns?.length - 1]?.status ?? null
);

sample({
    source: $game,
    target: createEffect(saveGame),
});
