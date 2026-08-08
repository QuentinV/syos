import { createChorus, logDebugMessage, TurnState } from '../chorus';
import { GameTurnStatus, PlayerRole, PlayerTurn } from './types';

const chorus = createChorus({
    debug: true,
});

export const {
    $peerId,
    $id: $gameId,
    $state: $game,
    events: gameEvents,
    init: initGame,
    workflows,
    Provider: GameProvider,
    participantStore,
} = chorus.createTurnSession<GameTurnStatus, PlayerTurn>({
    name: 'games',
    defaultValue: null,
    getJoinUrl: (sessionId, peerId) =>
        `${document.location.origin}/syos#/game/${sessionId}/join/${peerId}`,
    onMessage: (direction, message) => {
        logDebugMessage({ direction, message });
    },
    api: {
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

export const { $participant, setParticipantName } = participantStore!;
