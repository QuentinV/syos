import React from 'react';
import { useUnit } from 'effector-react';
import { $game } from '../../../state/game';

export const Running: React.FC = () => {
    const game = useUnit($game);

    if (!game) return null;

    return (
        <>
            <h2 className="text-center">Shape your own stories</h2>
        </>
    );
};
