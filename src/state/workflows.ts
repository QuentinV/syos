import { createEffect, sample } from 'effector';
import { setGameTurnStatus, $game, updatePlayersTurn } from './game';
import {
    Game,
    GamePlayersTurn,
    GameTurn,
    GameTurnStatus,
    Player,
    PlayerRole,
    PlayerTurn,
} from './types';
import { $player } from './player';

interface FlowTransition {
    from: GameTurnStatus;
    filter: (context: {
        game: Game;
        turn?: GameTurn;
        playerTurn?: PlayerTurn;
        player: Player;
    }) => boolean;
    logic?: (context: { game: Game; player: Player }) => () => any;
    next?: GameTurnStatus;
}

const workflows: FlowTransition[] = [
    {
        // storyteller selected all necessary cards, moving to next stage
        from: 'stPicksCards',
        filter: ({ playerTurn }) => playerTurn?.selectedCards?.length === 3,
        next: 'stWriteStory',
    },
    {
        // storyteller wrote story, moving to next stage
        from: 'stWriteStory',
        filter: ({ playerTurn }) => !!playerTurn?.story,
        next: 'pEstimate',
    },
    {
        from: 'pEstimate',
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
                    (prev, pk) => players[pk].estimateVisibleCards ?? 0 + prev,
                    0
                ) / playersVoted.length;

            const playersCorrect = playersKeys.filter(
                (pk) =>
                    storyteller.selectedCards!.filter(
                        (c) => players[pk].selectedCards?.includes(c) ?? 0
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
                    (c) => player.selectedCards?.includes(c) ?? 0
                ).length;

                console.log(player.role, correctCards, speed);

                prev[pk] = {
                    playerId: player.playerId,
                    score:
                        (playerTurn.score ?? 0) +
                        (correctCards / 3) * 50 +
                        Math.round(speed * 50),
                    speed,
                };

                return prev;
            }, {} as GamePlayersTurn);

            return () => updatePlayersTurn(update);
        },
        next: 'turnEnded',
    },
];

workflows.forEach((w) => {
    sample({
        source: { $game, $player },
        filter: ({ $game, $player }) => {
            if (!$game || !$player) return false;
            const turn = $game?.turns?.[$game?.turns?.length - 1];
            if (turn?.status !== w.from) return false;
            const playerTurn: PlayerTurn = turn?.players?.[$player?.id ?? ''];
            if (playerTurn?.role !== PlayerRole.storyteller) return false;
            return w.filter({
                game: $game,
                player: $player,
                playerTurn,
                turn,
            });
        },
        target: createEffect(
            ({
                $game,
                $player,
            }: {
                $game: Game | null;
                $player: Player | null;
            }) => {
                if (!$game || !$player) return;
                const res = w.logic?.({ game: $game, player: $player });
                if (w.next) setGameTurnStatus(w.next);
                res?.();
            }
        ),
    });
});
