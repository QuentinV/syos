import React from 'react';
import { useUnit } from 'effector-react';
import { $participant, gameEvents, useGame } from '../../../state/game';
import { SessionLobby } from '../../../chorus';

export const Lobby: React.FC = () => {
    const game = useGame();
    const participant = useUnit($participant);

    if (!game) return null;

    return (
        <SessionLobby
            participants={Object.keys(game.participants).map((key) => ({
                id: game.participants[key].id,
                name: game.participants[key].name,
                ready: game.participants[key].ready,
            }))}
            currentParticipantId={participant?.id}
            onToggleReady={(participantId) =>
                gameEvents.toggleParticipantReady(participantId)
            }
            onStart={() => gameEvents.startSession()}
            canStart={
                !Object.keys(game.participants).some(
                    (pk) => !game.participants[pk].ready
                )
            }
        />
    );
};
