import { createEffect, sample } from 'effector';
import { setGameTurnStatus, updatePlayerTurn, $game } from './game';
import {
    Game,
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
    logic?: (context: { game: Game; player: Player }) => void;
    next?: GameTurnStatus;
}

const workflows: FlowTransition[] = [
    {
        // storyteller selected all necessary cards, moving to next stage
        from: 'stPicksCards',
        filter: ({ playerTurn }) =>
            playerTurn?.role === PlayerRole.storyteller &&
            playerTurn?.selectedCards?.length === 3,
        next: 'stWriteStory',
    },
    {
        // storyteller wrote story, moving to next stage
        from: 'stWriteStory',
        filter: ({ playerTurn }) =>
            playerTurn?.role === PlayerRole.storyteller && !!playerTurn?.story,
        next: 'pEstimate',
    },
    {
        from: 'pEstimate',
        filter: ({ playerTurn, turn }) =>
            playerTurn?.role === PlayerRole.storyteller &&
            Object.keys(turn?.players ?? {}).every(
                (pk) => !!turn?.players?.[pk]?.estimateVisibleCards
            ),
        next: 'pPicksCards',
    },
    {
        // end of turn
        from: 'pPicksCards',
        filter: ({ playerTurn }) =>
            playerTurn?.role === PlayerRole.gremlin &&
            !!playerTurn?.selectedCardsTime,
        logic: ({ game, player }) => {
            const previousScore =
                game.turns[game.turns.length - 2]?.players?.[player.id]
                    ?.score ?? 0;
            const gameTurn = game.turns[game.turns.length - 1];
            const playerTurn = gameTurn.players[player.id];
            const speed =
                1 -
                (playerTurn.selectedCardsTime?.getTime() ?? 0) /
                    ((playerTurn.displayedCardsTime?.getTime() ?? 0) +
                        (gameTurn.timeoutPlayerSelectCards ?? 0));
            updatePlayerTurn({
                playerId: player.id,
                score:
                    previousScore +
                    (playerTurn.selectedCards?.length === 3 ? 50 : 0) +
                    speed * 50,
                speed,
            });
        },
        next: 'waitForPlayers',
    },
    {
        from: 'waitForPlayers',
        filter: ({ playerTurn, turn }) =>
            playerTurn?.role === 'storyteller' &&
            Object.keys(turn?.players ?? {}).every(
                (pk) => !!turn?.players?.[pk]?.selectedCardsTime
            ),
        logic: ({ game, player }) => {
            const previousScore =
                game.turns[game.turns.length - 2]?.players?.[player.id]
                    ?.score ?? 0;
            const gameTurn = game.turns[game.turns.length - 1];
            const playerTurn = gameTurn.players[player.id];

            const speed =
                1 -
                (playerTurn.selectedCardsTime?.getTime() ?? 0) /
                    ((playerTurn.displayedCardsTime?.getTime() ?? 0) +
                        (gameTurn.timeoutPlayerSelectCards ?? 0));

            updatePlayerTurn({
                playerId: player.id,
                score: previousScore + 50 + speed * 50,
                speed,
            });
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
                w.logic?.({ game: $game, player: $player });
                if (w.next) setGameTurnStatus(w.next);
            }
        ),
    });
});
