import { createEffect, sample, attach } from 'effector';
import {
    $game,
    initGame,
    loadGameFromStorageFx,
    setGameTurnStatus,
    setPeerId,
} from './game';
import { connectToPeer, initPeerConnection, sendMessage } from '../api/rtc';
import { $player } from './player';
import { Game, newGame, Player, PlayerTurn } from '../api/game';

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

// storyteller selected all necessary cards, moving to next stage
sample({
    source: { $game, $player },
    filter: ({ $game, $player }) => {
        const turn = $game?.turns?.[$game?.turns?.length - 1];
        if (turn?.status !== 'stSeeCards') return false;
        const playerTurn: PlayerTurn = turn?.players?.[$player?.id ?? ''];
        return (
            playerTurn.role === 'storyteller' &&
            playerTurn?.selectedCards?.length === 3
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
            setGameTurnStatus('stWriteStory');
        }
    ),
});
