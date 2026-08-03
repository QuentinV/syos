import React from 'react';
import { useUnit } from 'effector-react';
import { DebugPanel } from '../../chorus';
import { $game, $peerId } from '../../state/game';
import { computeGameChecksum } from '../../state/checksum';

export const GameDebugPanel: React.FC = () => {
    const game = useUnit($game);
    const peerId = useUnit($peerId);

    return (
        <DebugPanel
            state={game}
            peerId={peerId}
            liveChecksum={game ? computeGameChecksum(game) : undefined}
        />
    );
};
