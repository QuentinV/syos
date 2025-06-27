import React from 'react';
import { usePlayersTurn } from '../../state/gameHooks';
import './styles.css';
import { PlayerRole } from '../../state/types';
import { useUnit } from 'effector-react';
import { $player } from '../../state/player';

interface PlayersBoardProps {
    markStoryteller?: boolean;
}

export const PlayersBoard: React.FC<PlayersBoardProps> = ({
    markStoryteller,
}) => {
    const playersTurns = usePlayersTurn();
    const player = useUnit($player);
    return (
        <div className="flex flex-column gap-2 mb-3">
            {playersTurns.map((p) => (
                <div
                    key={p.playerId}
                    className={`playerBoard ${p.player?.ready ? 'playerReady' : ''}`}
                >
                    <div>
                        <div className="playerAvatar ">
                            {p.player?.name ?? 'unknown'}
                        </div>
                    </div>
                    <div>{p.score}</div>
                    {!!markStoryteller && p.role === PlayerRole.storyteller && (
                        <i className="pi pi-circle-fill text-primary" />
                    )}
                    {(!markStoryteller || p.role === PlayerRole.gremlin) &&
                        p.playerId === player?.id && (
                            <i className="pi pi-circle-fill" />
                        )}
                </div>
            ))}
        </div>
    );
};
