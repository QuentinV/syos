import React, { useEffect } from 'react';
import { useUnit } from 'effector-react';
import {
    $game,
    $gameTurnStatus,
    newPlayerTurn,
    newTurn,
} from '../../../state/game';
import { $player } from '../../../state/player';
import { Storyteller } from './Storyteller';
import { Player } from './Player';
import { usePlayerTurn } from '../../../state/gameHooks';
import { PlayersBoard } from '../../../components/PlayersBoard';

export const Running: React.FC = () => {
    const game = useUnit($game);
    const player = useUnit($player);
    const gameTurnStatus = useUnit($gameTurnStatus);
    const playerTurn = usePlayerTurn();

    useEffect(() => {
        if (!game?.turns.length) {
            newTurn();
        }
    }, [game]);

    useEffect(() => {
        if (player && !playerTurn) {
            newPlayerTurn(player);
        }
    }, [player, playerTurn]);

    if (!game || !player || !playerTurn) return null;

    const renderGameMode = () => {
        return playerTurn.role === 'storyteller' ? <Storyteller /> : <Player />;
    };

    return (
        <>
            <h2 className="text-center">Shape your own stories</h2>
            <div>Game turn status: {gameTurnStatus ?? 'no status'}</div>
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
