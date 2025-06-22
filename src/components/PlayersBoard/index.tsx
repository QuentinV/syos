import React from 'react';
import { usePlayersTurn } from '../../state/gameHooks';
import './styles.css';
import { PlayerRole } from '../../state/types';

export const PlayersBoard: React.FC = () => {
    const playersTurns = usePlayersTurn();
    return (
        <div className="flex flex-column gap-2">
            {playersTurns.map((p) => (
                <div
                    className={`playerBoard ${p.player?.ready ? 'playerReady' : ''}`}
                >
                    <div>
                        <div className="playerAvatar ">
                            {p.player?.name ?? 'unknown'}
                        </div>
                    </div>
                    <div>{p.score}</div>
                    {p.role === PlayerRole.storyteller && (
                        <i className="pi pi-pen-to-square" />
                    )}
                </div>
            ))}
        </div>
    );
};
