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
import { Gremlin } from './Gremlin';

export const Running: React.FC = () => {
    const game = useUnit($game);
    const player = useUnit($player);
    const gameTurnStatus = useUnit($gameTurnStatus);
    const turn = game?.turns?.[game?.turns?.length - 1];
    const playerTurn = turn?.players?.[player?.id ?? ''];

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
        return playerTurn.role === 'storyteller' ? (
            <Storyteller />
        ) : (
            <Gremlin />
        );
    };

    return (
        <>
            <h2 className="text-center">Shape your own stories</h2>
            <div>Game turn status: {gameTurnStatus ?? 'no status'}</div>
            <div className="flex col-12">
                <div className="col-3"></div>
                <div className="col-6">Turns: {game.turns.length} / 10</div>
                <div className="col-3"></div>
            </div>
            <div className="flex flex-column align-items-center">
                {renderGameMode()}
            </div>
        </>
    );
};
