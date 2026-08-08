import { useUnit } from 'effector-react';
import React from 'react';
import { useParams } from 'react-router';
import { $participant } from '../../state/game';
import { JoinSession } from '../../chorus';

export const JoinPage: React.FC = () => {
    const { gameId, peerId } = useParams();
    const participant = useUnit($participant);

    return (
        <JoinSession
            sessionId={gameId}
            peerId={peerId}
            participantName={participant?.name}
        />
    );
};
