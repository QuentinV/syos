import { createChorus, logDebugMessage, TurnState } from '../chorus';
import { computeGameChecksum } from './checksum';
import { GameTurnStatus, PlayerRole, PlayerTurn } from './types';

export { computeGameChecksum } from './checksum';

const chorus = createChorus({
    debug: true,
});

export const {
    store: gameDS,
    joinFx,
    $peerId,
    $id: $gameId,
    $state: $game,
    events: gameEvents,
    useStore: useGame,
    init: initGame,
    usePeerId,
    workflows,
    Provider: GameProvider,
} = chorus.createTurnSession<GameTurnStatus, PlayerTurn>({
    name: 'games',
    defaultValue: null,
    checksum: computeGameChecksum,
    getJoinUrl: (sessionId, peerId) =>
        `${document.location.origin}/syos#/game/${sessionId}/join/${peerId}`,
    onMessage: (direction, message) => {
        logDebugMessage({ direction, message });
    },
    api: {
        // Add a player to the current turn with a role (storyteller/gremlin)
        newPlayerTurn: (
            game: TurnState<GameTurnStatus, PlayerTurn>,
            player: { id: string }
        ) => {
            if (!game) return null;
            const lastIndex = game.turns.length - 1;
            if (lastIndex < 0) return game;
            const turn = game.turns[lastIndex];
            if (turn.participants[player.id]) return game;
            const hasStoryteller = Object.keys(turn.participants).some(
                (k) => turn.participants[k].role === PlayerRole.storyteller
            );
            const updatedTurn = {
                ...turn,
                participants: {
                    ...turn.participants,
                    [player.id]: {
                        playerId: player.id,
                        role: hasStoryteller
                            ? PlayerRole.gremlin
                            : PlayerRole.storyteller,
                        score: 0,
                    },
                },
            };
            return {
                ...game,
                turns: [...game.turns.slice(0, lastIndex), updatedTurn],
            };
        },
        setDisplayedCards: (
            game: TurnState<GameTurnStatus, PlayerTurn>,
            state: { playerId: string; cardIndexes: number[] }
        ) => {
            if (!game) return null;
            const lastIndex = game.turns.length - 1;
            if (lastIndex < 0) return game;
            const turn = game.turns[lastIndex];
            const playerTurn = turn.participants[state.playerId];
            if (!playerTurn) return game;
            const updatedTurn = {
                ...turn,
                participants: {
                    ...turn.participants,
                    [state.playerId]: {
                        ...playerTurn,
                        displayedCards: state.cardIndexes,
                        displayedCardsTime: Date.now(),
                    },
                },
            };
            return {
                ...game,
                turns: [...game.turns.slice(0, lastIndex), updatedTurn],
            };
        },
        selectCard: (
            game: TurnState<GameTurnStatus, PlayerTurn>,
            state: { playerId: string; cardIndex: number }
        ) => {
            if (!game) return null;
            const lastIndex = game.turns.length - 1;
            if (lastIndex < 0) return game;
            const turn = game.turns[lastIndex];
            const playerTurn = turn.participants[state.playerId];
            if (!playerTurn) return game;
            const updatedTurn = {
                ...turn,
                participants: {
                    ...turn.participants,
                    [state.playerId]: {
                        ...playerTurn,
                        selectedCards: [
                            ...new Set([
                                ...(playerTurn.selectedCards ?? []),
                                state.cardIndex,
                            ]),
                        ],
                    },
                },
            };
            return {
                ...game,
                turns: [...game.turns.slice(0, lastIndex), updatedTurn],
            };
        },
        setTimeEstimate: (
            game: TurnState<GameTurnStatus, PlayerTurn>,
            state: { playerId: string; estimate: number }
        ) => {
            if (!game) return null;
            const lastIndex = game.turns.length - 1;
            if (lastIndex < 0) return game;
            const turn = game.turns[lastIndex];
            const playerTurn = turn.participants[state.playerId];
            if (!playerTurn) return game;
            const updatedTurn = {
                ...turn,
                participants: {
                    ...turn.participants,
                    [state.playerId]: {
                        ...playerTurn,
                        estimateVisibleCards: state.estimate,
                    },
                },
            };
            return {
                ...game,
                turns: [...game.turns.slice(0, lastIndex), updatedTurn],
            };
        },
    },
});
