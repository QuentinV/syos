import { createEffect, sample, attach, createEvent } from 'effector';
import {
    $game,
    gameDS,
    joinFx,
    setGameTurnStatus,
    updateGame,
    updatePlayerTurn,
} from './game';
import { $player } from './player';
import { v4 as uuid } from 'uuid';
import { Game, GameTurn, GameTurnStatus, Player, PlayerTurn } from './types';

export const newGameFx = attach({
    source: { $player },
    effect: createEffect(({ $player }: { $player: Player | null }) => {
        const id = uuid();
        const game: Game = {
            id,
            createdAt: new Date(),
            status: 'lobby',
            players: {},
            turns: [],
        };
        if ($player) {
            game.players = { [$player.id]: $player };
        }
        return game;
    }),
});

sample({
    source: newGameFx.doneData,
    target: updateGame,
});

const joined = createEvent<Player | null>();
gameDS.on('joined', joined, (game, player: Player | null) => {
    console.log('JOINED EVENT');
    if (!game || !player) {
        console.log('ERROR GAME NOT FOUND');
        return;
    }
    game.players[player.id] = player;
    return { ...game };
});

sample({
    source: $player,
    clock: joinFx.doneData,
    fn: (player, gameId) => ({ gameId: gameId!, player }),
    target: createEffect(
        ({ gameId, player }: { gameId: string; player: Player | null }) => {
            joined(player);
            console.log('redirect to game');
            location.href = `http://localhost:3000/syos#/game/${gameId}`;
        }
    ),
});

interface FlowTransition {
    from: GameTurnStatus;
    filter?: (context: {
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
            playerTurn?.role === 'storyteller' &&
            playerTurn?.selectedCards?.length === 3,
        next: 'stWriteStory',
    },
    {
        // storyteller wrote story, moving to next stage
        from: 'stWriteStory',
        filter: ({ playerTurn }) =>
            playerTurn?.role === 'storyteller' && !!playerTurn?.story,
        next: 'pPicksCards',
    },
    {
        // end of turn
        from: 'pPicksCards',
        filter: ({ playerTurn }) =>
            playerTurn?.role === 'gremlin' && !!playerTurn?.selectedCardsTime,
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
            });
        },

        // TODO allocate points to storyteller based on how many people found correctly and fast ?
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
            return (
                w.filter?.({
                    game: $game,
                    player: $player,
                    playerTurn,
                    turn,
                }) ?? true
            );
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
