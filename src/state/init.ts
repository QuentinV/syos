import { createEffect, sample, attach } from 'effector';
import {
    $game,
    initGame,
    loadGameFromStorageFx,
    resetSelectedCardsTime,
    setGameTurnStatus,
    setPeerId,
} from './game';
import { connectToPeer, initPeerConnection, sendMessage } from '../api/rtc';
import { $player } from './player';
import {
    Game,
    GameTurn,
    GameTurnStatus,
    newGame,
    Player,
    PlayerTurn,
} from '../api/game';

sample({
    clock: initGame,
    fn: (id) => ({ id }),
    target: createEffect(async ({ id }: { id: string }) => {
        const game = await loadGameFromStorageFx({ id });

        const peerGameData = await initPeerConnection({ gameId: id });
        setPeerId(peerGameData.peerId);

        console.log('game initialized');
    }),
});

export const newGameFx = attach({
    source: { $player },
    effect: createEffect(({ $player }: { $player: Player | null }) => {
        if (!$player) return;
        return newGame({ player: $player });
    }),
});

export const joinGameFx = attach({
    source: { $player },
    mapParams: (params: { gameId: string; peerId: string }, source) => ({
        ...params,
        ...source,
    }),
    effect: createEffect(
        async ({
            gameId,
            peerId,
            $player,
        }: {
            gameId: string;
            peerId: string;
            $player: Player | null;
        }) => {
            const game = await loadGameFromStorageFx({ id: gameId });
            if (game) {
                console.log('GAME ALREADY EXISTING');
                return;
            }

            console.log('joining game of peer ', gameId, peerId);
            const peerGameData = await initPeerConnection({ gameId });

            const peerInfo = await connectToPeer(peerGameData, peerId);

            await sendMessage({
                gameId,
                peerId,
                message: {
                    type: 'joinGame',
                    data: {
                        player: $player,
                    },
                },
            });

            console.log('message sent ');
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
    next: GameTurnStatus;
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
            playerTurn?.role === 'gremlin' &&
            playerTurn?.selectedCards?.length === 3,
        logic: ({ player }) => resetSelectedCardsTime({ playerId: player.id }),
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
                setGameTurnStatus(w.next);
            }
        ),
    });
});
