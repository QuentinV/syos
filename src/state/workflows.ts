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
import { A } from 'react-router/dist/development/route-data-B9_30zbP';

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

            const update = Object.keys(players).reduce((prev, pk) => {
                const player = players[pk];
                const previousScore =
                    game.turns[game.turns.length - 2]?.players?.[
                        player.playerId
                    ]?.score ?? 0;
                const playerTurn = gameTurn.players[player.playerId];
                const speed =
                    1 -
                    (playerTurn.selectedCardsTime ?? 0) /
                        ((playerTurn.displayedCardsTime ?? 1) +
                            (gameTurn.timeoutPlayerSelectCards ?? 0));

                const scorePlus =
                    player.role === PlayerRole.gremlin
                        ? playerTurn.selectedCards?.length === 3
                            ? 50
                            : 0
                        : 50;

                prev[pk] = {
                    playerId: player.playerId,
                    score: previousScore + scorePlus + speed * 50,
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
