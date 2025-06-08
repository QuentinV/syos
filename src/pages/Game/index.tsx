import '../../state/init';
import React, { useEffect } from 'react';
import { useParams } from 'react-router';
import { $game, initGame } from '../../state/game';
import { useUnit } from 'effector-react';
import { Lobby } from './Lobby';
import { End } from './End';
import { Running } from './Running';

export const GamePage = () => {
    const { id } = useParams();
    const game = useUnit($game);

    useEffect(() => {
        initGame(id ?? '');
    }, [id]);

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
