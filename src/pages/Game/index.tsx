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

const views = {
    lobby: Lobby,
    running: Running,
    finished: End,
} as const;

export const GamePage: React.FC<GamePageProps> = ({ id, init = true }) => {
    const { id: idParams } = useParams();
    const gameId = id ?? idParams;
    const game = useGame();

    useEffect(() => {
        if (init && gameId) {
            initGame(gameId);
        }
    }, [gameId, init]);

    if (!game) return null;

    const View = views[game.status];

    return View ? <View /> : null;
};
