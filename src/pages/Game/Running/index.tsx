import React, { useEffect } from 'react';
import { useUnit } from 'effector-react';
import { newPlayerTurn, newTurn, useGame } from '../../../state/game';
import { $player } from '../../../state/player';
import { Storyteller } from './Storyteller';
import { Player } from './Player';
import { useGameTurnStatus, usePlayerTurn } from '../../../state/gameHooks';
import { PlayersBoard } from '../../../components/PlayersBoard';

export const Running: React.FC = () => {
    const game = useGame();
    const player = useUnit($player);
    const playerTurn = usePlayerTurn();

    if (!game || !player || !playerTurn) return null;

    const renderGameMode = () => {
        return playerTurn.role === 'storyteller' ? <Storyteller /> : <Player />;
    };

    return (
        <>
            <h2 className="text-center">Shape your own stories</h2>
            <div className="flex col-12">
                <div className="col-2"></div>
                <div className="col-2">
                    <div className="mb-3">Turns: {game.turns.length} / 10</div>
                    <PlayersBoard />
                </div>
                <div className="col-6">{renderGameMode()}</div>
                <div className="col-2"></div>
            </div>
        </>
    );
};
