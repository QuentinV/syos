import React from 'react';
import { useUnit } from 'effector-react';
import { gameEvents, useGame, GameProvider } from '../../../state/game';
import { $participant } from '../../../state/player';
import { SessionLobby } from '../../../chorus';

export const Lobby: React.FC = () => {
    const game = useGame();
    const participant = useUnit($participant);

    if (!game) return null;

    return (
        <GameProvider>
            <SessionLobby
                participants={Object.keys(game.players).map((key) => ({
                    id: game.players[key].id,
                    name: game.players[key].name,
                    ready: game.players[key].ready,
                }))}
                currentParticipantId={participant?.id}
                onToggleReady={(participantId) =>
                    gameEvents.toggleParticipantReady(participantId)
                }
                onStart={() => gameEvents.startSession()}
                canStart={
                    !Object.keys(game.players).some(
                        (pk) => !game.players[pk].ready
                    )
                }
            />
        </GameProvider>
    );
};
