import React from 'react';
import { useUnit } from 'effector-react';
import {
    startGame,
    togglePlayerReady,
    useGame,
    GameProvider,
} from '../../../state/game';
import { $player } from '../../../state/player';
import { SessionLobby } from '../../../chorus';

export const Lobby: React.FC = () => {
    const game = useGame();
    const player = useUnit($player);

    if (!game) return null;

    return (
        <GameProvider>
            <SessionLobby
                participants={Object.keys(game.players).map((key) => ({
                    id: game.players[key].id,
                    name: game.players[key].name,
                    ready: game.players[key].ready,
                }))}
                currentParticipantId={player?.id}
                onToggleReady={(participantId) =>
                    togglePlayerReady(participantId)
                }
                onStart={() => startGame()}
                canStart={
                    !Object.keys(game.players).some(
                        (pk) => !game.players[pk].ready
                    )
                }
            />
        </GameProvider>
    );
};
