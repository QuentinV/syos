import { gameEvents, workflows } from './game';
import {
    Game,
    GameParticipantsTurn,
    GameTurn,
    PlayerRole,
    PlayerTurn,
} from './types';

const getStorytellerTurn = (
    turn: GameTurn | undefined
): PlayerTurn | undefined =>
    Object.values(turn?.participants ?? {}).find(
        (p) => p.role === PlayerRole.storyteller
    );

const deriveContext = (game: Game | null) => {
    const turn: GameTurn | undefined = game?.turns?.[game?.turns?.length - 1];
    return {
        game,
        turn,
    };
};

workflows({
    context: deriveContext,
    transitions: [
        {
            // storyteller selected all necessary cards, moving to next stage
            from: 'stPicksCards',
            filter: ({ turn }) =>
                getStorytellerTurn(turn)?.selectedCards?.length === 3,
            next: 'stWriteStory',
        },
        {
            // storyteller wrote story, moving to next stage
            from: 'stWriteStory',
            filter: ({ turn }) => !!getStorytellerTurn(turn)?.story,
            next: 'pEstimate',
        },
        {
            from: 'pEstimate',
            filter: ({ turn }) =>
                Object.keys(turn?.participants ?? {}).every(
                    (pk) =>
                        turn?.participants?.[pk].role ===
                            PlayerRole.storyteller ||
                        !!turn?.participants?.[pk]?.estimateVisibleCards
                ),
            next: 'pPicksCards',
        },
        {
            from: 'pPicksCards',
            filter: ({ turn }) =>
                Object.keys(turn?.participants ?? {}).every(
                    (pk) =>
                        turn?.participants?.[pk].role ===
                            PlayerRole.storyteller ||
                        !!turn?.participants?.[pk]?.selectedCardsTime
                ),
            logic: ({ game }) => {
                const gameTurn = game.turns[game.turns.length - 1];
                const players = gameTurn.participants;
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
                }, {} as GameParticipantsTurn);

                return () => gameEvents.updateTurnParticipants(update);
            },
            next: 'turnEnded',
        },
        {
            from: 'turnEnded',
            filter: ({ game }) => game.turns.length >= 10,
            logic: () => {
                gameEvents.endSession();
            },
        },
    ],
});
