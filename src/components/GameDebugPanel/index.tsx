import React from 'react';
import { DebugPanel, useSessionState } from '../../chorus';
import { Game } from '../../state/types';

export const GameDebugPanel: React.FC = () => {
    const game = useSessionState<Game>();

    return <DebugPanel state={game} />;
};
