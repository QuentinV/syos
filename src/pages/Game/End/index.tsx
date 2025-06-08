import React from 'react';
import { useUnit } from 'effector-react';
import { $game } from '../../../state/game';

export const End: React.FC = () => {
    const game = useUnit($game);

    if (!game) return null;

    return (
        <div>
            <h2>Game is finished</h2>
        </div>
    );
};
