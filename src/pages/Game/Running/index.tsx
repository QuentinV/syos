import React from 'react';
import { useUnit } from 'effector-react';
import {
    $participant,
    useActiveParticipant,
    useGame,
} from '../../../state/game';
import { Storyteller } from './Storyteller';
import { Player } from './Player';
import { PlayersBoard } from '../../../components/PlayersBoard';

export const Running: React.FC = () => {
    const game = useGame();
    const participant = useUnit($participant);
    const playerTurn = useActiveParticipant();

    if (!game || !participant || !playerTurn) return null;

    const renderGameMode = () => {
        return playerTurn.role === 'storyteller' ? <Storyteller /> : <Player />;
    };

    return (
        <>
            <h2 className="text-center">Shape your own stories</h2>
            <div className="flex justify-content-center flex-wrap">
                <div className="w-15rem">
                    <div className="mb-3">Turns: {game.turns.length} / 10</div>
                    <PlayersBoard markStoryteller />
                </div>
                <div>{renderGameMode()}</div>
            </div>
        </>
    );
};
