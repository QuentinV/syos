import React from 'react';
import { useUnit } from 'effector-react';
import {
    startGame,
    togglePlayerReady,
    useGame,
    usePeerId,
} from '../../../state/game';
import { $player } from '../../../state/player';
import { SessionLobby } from '../../../chorus';

const getJoinUrl = (gameId: string, peerId: string) =>
    `${document.location.origin}/syos#/game/${gameId}/join/${peerId}`;

export const Lobby: React.FC = () => {
    const game = useGame();
    const player = useUnit($player);
    const peerId = usePeerId();

    if (!game || !peerId) return null;

    return (
        <SessionLobby
            sessionId={game.id}
            peerId={peerId}
            players={Object.keys(game.players).map((key) => ({
                id: game.players[key].id,
                name: game.players[key].name,
                ready: game.players[key].ready,
            }))}
            currentPlayerId={player?.id}
            joinUrl={getJoinUrl(game.id, peerId)}
            onToggleReady={(playerId) => togglePlayerReady(playerId)}
            onStart={() => startGame()}
            canStart={
                !Object.keys(game.players).some((pk) => !game.players[pk].ready)
            }
        />
    );
};
