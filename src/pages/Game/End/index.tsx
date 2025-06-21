import React from 'react';
import { useGame } from '../../../state/game';

export const End: React.FC = () => {
    const game = useGame();

    if (!game) return null;

    return (
        <div>
            <h2>Game is finished</h2>
        </div>
    );
};
