import React from 'react';
import { useGame } from '../../../state/game';
import { PlayersBoard } from '../../../components/PlayersBoard';

export const End: React.FC = () => {
    const game = useGame();

    if (!game) return null;

    return (
        <div>
            <h2>Game is finished</h2>
            <PlayersBoard />
        </div>
    );
};
