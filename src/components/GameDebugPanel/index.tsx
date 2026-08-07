import React from 'react';
import { useUnit } from 'effector-react';
import { DebugPanel } from '../../chorus';
import { $game } from '../../state/game';

export const GameDebugPanel: React.FC = () => {
    const game = useUnit($game);

    return <DebugPanel state={game} />;
};
