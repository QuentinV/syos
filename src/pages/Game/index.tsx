import '../../state/init';
import React from 'react';
import { useParams } from 'react-router';
import { initGame, GameProvider } from '../../state/game';
import { Lobby } from './Lobby';
import { End } from './End';
import { Running } from './Running';
import { SessionPage, useSessionState } from '@quentinv/chorus';

export interface GamePageProps {
    id?: string;
    init?: boolean;
}

export const GamePage: React.FC<GamePageProps> = ({
    id: idProp,
    init = true,
}) => {
    const { id: idParams } = useParams();
    const id = idProp ?? idParams;

    return (
        <SessionPage id={id} init={init} initSession={initGame}>
            <GameProvider>
                <GameContent />
            </GameProvider>
        </SessionPage>
    );
};

const GameContent: React.FC = () => {
    const game = useSessionState();

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
