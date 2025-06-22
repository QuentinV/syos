import '../../state/init';
import React, { useEffect } from 'react';
import { useParams } from 'react-router';
import { initGame, useGame } from '../../state/game';
import { Lobby } from './Lobby';
import { End } from './End';
import { Running } from './Running';

export interface GamePageProps {
    id?: string;
    init?: boolean;
}

export const GamePage: React.FC<GamePageProps> = ({ id, init = true }) => {
    const { id: idParams } = useParams();
    const i = id ?? idParams;
    const game = useGame();

    useEffect(() => {
        if (init) {
            initGame(i ?? '');
        }
    }, [i, init]);

    if (!game) return null;

    const renderBasedOnStatus = () => {
        switch (game.status) {
            case 'lobby':
                return <Lobby />;
            case 'running':
                return <Running />;
            case 'finished':
                return <End />;
        }
    };

    return <div>{renderBasedOnStatus()}</div>;
};
