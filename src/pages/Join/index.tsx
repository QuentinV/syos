import '../../state/init';
import { useUnit } from 'effector-react';
import React, { useEffect } from 'react';
import { useParams } from 'react-router';
import { $participant, joinFx } from '../../state/game';
import { JoinSession } from '../../chorus';

export const JoinPage: React.FC = () => {
    const { gameId, peerId } = useParams();
    const participant = useUnit($participant);

    useEffect(() => {
        if (!peerId || !gameId) {
            return;
        }
        joinFx({ objectId: gameId, peerId });
    }, [gameId, peerId]);

    if (!peerId || !gameId) return null;

    return (
        <JoinSession
            sessionId={gameId}
            peerId={peerId}
            participantName={participant?.name}
        />
    );
};
