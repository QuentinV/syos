import { useUnit } from 'effector-react';
import React, { useEffect } from 'react';
import { useParams } from 'react-router';
import { $player } from '../../state/player';
import { joinGameFx } from '../../state/init';

export const JoinPage: React.FC = () => {
    const { gameId, peerId } = useParams();
    const player = useUnit($player);

    useEffect(() => {
        if (!peerId || !gameId) {
            return;
        }
        joinGameFx({ gameId, peerId });
    }, [gameId, peerId]);

    return (
        <div className="m-auto">
            <h2>Hello {player?.name}</h2>
            <div>
                You are being connected
                <div>- Game {gameId}</div>
                <div>- Peer {peerId}</div>
            </div>
            <div className="text-center mt-5">
                <i className="pi pi-spin pi-spinner mr-2" />
                Please hold on
            </div>
        </div>
    );
};
