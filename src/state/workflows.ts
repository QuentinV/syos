import { gameEvents, workflows } from './game';
import {
    Game,
    GamePlayersTurn,
    GameTurn,
    PlayerRole,
    PlayerTurn,
} from './types';
import { $participant } from './player';

// Derive the workflow context from game state + local participant
const deriveContext = (game: Game | null) => {
    const participant = $participant.getState();
    const turn: GameTurn | undefined = game?.turns?.[game?.turns?.length - 1];
    const playerTurn: PlayerTurn | undefined =
        turn?.players?.[participant?.id ?? ''];
    return {
        game,
        turn,
        playerTurn,
        participant,
    };
};

workflows({
    transitions: [
        {
            // storyteller selected all necessary cards, moving to next stage
            from: 'stPicksCards',
            context: deriveContext,
            filter: ({ playerTurn }) => playerTurn?.selectedCards?.length === 3,
            next: 'stWriteStory',
        },
        {
            // storyteller wrote story, moving to next stage
            from: 'stWriteStory',
            context: deriveContext,
            filter: ({ playerTurn }) => !!playerTurn?.story,
            next: 'pEstimate',
        },
        {
            from: 'pEstimate',
            context: deriveContext,
            filter: ({ turn }) =>
                Object.keys(turn?.players ?? {}).every(
                    (pk) =>
                        turn?.players?.[pk].role === PlayerRole.storyteller ||
                        !!turn?.players?.[pk]?.estimateVisibleCards
                ),
            next: 'pPicksCards',
        },
        {
            from: 'pPicksCards',
            context: deriveContext,
            filter: ({ turn }) =>
                Object.keys(turn?.players ?? {}).every(
                    (pk) =>
                        turn?.players?.[pk].role === PlayerRole.storyteller ||
                        !!turn?.players?.[pk]?.selectedCardsTime
                ),
            logic: ({ game }) => {
                const gameTurn = game.turns[game.turns.length - 1];
                const players = gameTurn.players;
                const playersKeys = Object.keys(players);
                const storyteller =
                    players[
                        playersKeys.find(
                            (pk) => players[pk].role === PlayerRole.storyteller
                        ) ?? ''
                    ];

                const playersVoted = playersKeys.filter(
                    (k) => players[k].estimateVisibleCards !== -1
                );

                const timeoutSelectCards =
                    playersVoted.reduce(
                        (prev, pk) =>
                            players[pk].estimateVisibleCards ?? 0 + prev,
                        0
                    ) / playersVoted.length;

                const playersCorrect = playersKeys.filter(
                    (pk) =>
                        storyteller.selectedCards!.filter(
                            (c: number) =>
                                players[pk].selectedCards?.includes(c) ?? 0
                        ).length === 3
                );

                const update = playersKeys.reduce((prev, pk) => {
                    const player = players[pk];
                    const playerTurn = players[player.playerId];

                    const speed =
                        player.role === PlayerRole.gremlin
                            ? timeoutSelectCards /
                              ((playerTurn.selectedCardsTime ?? 0) -
                                  (playerTurn.displayedCardsTime ?? 0))
                            : (playersCorrect.length - 1) /
                              (playersKeys.length - 1);

                    const correctCards = storyteller.selectedCards!.filter(
                        (c: number) => player.selectedCards?.includes(c) ?? 0
                    ).length;

                    prev[pk] = {
                        playerId: player.playerId,
                        score:
                            (playerTurn.score ?? 0) +
                            Math.round((correctCards / 3) * 50) +
                            Math.round(speed * 50),
                        speed,
                    };

                    return prev;
                }, {} as GamePlayersTurn);

                return () => gameEvents.updateTurnPlayers(update);
            },
            next: 'turnEnded',
        },
        {
            from: 'turnEnded',
            context: deriveContext,
            filter: ({ game }) => game.turns.length >= 10,
            logic: () => {
                gameEvents.endSession();
            },
        },
    ],
});
