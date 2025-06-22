import { createEvent, sample } from 'effector';
import {
    Game,
    GamePlayersTurn,
    GameTurn,
    GameTurnStatus,
    Player,
    PlayerTurn,
} from './types';
import { createDSApi } from '../utils/dsApi';

export const {
    store: gameDS,
    joinFx,
    $store: $game,
    events: gameEvents,
    useStore: useGame,
    init: initGame,
    usePeerId,
} = createDSApi<Game | null>({
    dbStoreName: 'games',
    defaultValue: null,
});

export const updateGame = createEvent<Game>();
export const togglePlayerReady = createEvent<string>();
export const startGame = createEvent<void>();
export const newTurn = createEvent<GameTurn | undefined>();
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
export const updatePlayerTurn = createEvent<PlayerTurn>();

const changePlayerTurn = (
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

gameDS
    .on('updateGame', updateGame, (_, state) => ({ ...state }))
    .on('togglePlayerReady', togglePlayerReady, (game, playerId) => {
        if (!game) return null;
        game.players[playerId].ready = !game.players[playerId].ready;
        return { ...game };
    })
    .on('startGame', startGame, (game) =>
        game ? { ...game, status: 'running' } : null
    )
    .on('newTurn', newTurn, (game, turn) =>
        game && turn
            ? {
                  ...game,
                  turns: [...game.turns, turn],
              }
            : game
    )
    .on('newPlayerTurn', newPlayerTurn, (game, player) => {
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
                : 'storyteller', //FIXME
            score: 0,
        };
        return { ...game };
    })
    .on('setDisplayedCards', setDisplayedCards, (game, state) =>
        changePlayerTurn(game, state.playerId, (playerTurn) => {
            playerTurn.displayedCards = state.cardIndexes;
            playerTurn.displayedCardsTime = new Date();
        })
    )
    .on('selectCard', selectCard, (game, state) =>
        changePlayerTurn(game, state.playerId, (playerTurn) => {
            playerTurn.selectedCards = [
                ...new Set([
                    ...(playerTurn.selectedCards ?? []),
                    state.cardIndex,
                ]),
            ];
        })
    )
    .on('setGameTurnStatus', setGameTurnStatus, (game, status) => {
        if (!game) return null;
        const turn = game?.turns?.[game?.turns?.length - 1];
        if (!turn) return game;
        turn.status = status;
        return { ...game };
    })
    .on('updatePlayerTurn', updatePlayerTurn, (game, state) => {
        if (!game) return null;
        const playerTurn =
            game?.turns?.[game?.turns?.length - 1]?.players?.[state.playerId];
        if (!playerTurn) return game;
        game.turns[game.turns.length - 1].players[state.playerId] = {
            ...playerTurn,
            ...state,
        };
        return { ...game };
    });
