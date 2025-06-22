import React from 'react';
import { usePlayersTurn, useTurn } from '../../../state/gameHooks';
import { useUnit } from 'effector-react';
import { $player } from '../../../state/player';
import { Avatar } from 'primereact/avatar';
import { GameCards } from '../../../components/GameCards';

export const PlayersStatus: React.FC = () => {
    const players = usePlayersTurn();
    const player = useUnit($player);

    if (!player || !players?.length) return null;

    const renderSpeed = (s?: number) => {
        if (s === undefined) return;
        if (s > 0.9) {
            return 'Crazy fast!';
        }
        if (s > 0.7) {
            return 'Super fast';
        }
        if (s > 0.5) {
            return 'Faster than average';
        }
        if (s > 0.3) {
            return 'Has room to improve speed';
        }
        return 'Still online?';
    };

    return (
        <>
            <div className="mb-2">Status of other players</div>
            <div>
                {players.map((p, i) =>
                    p.playerId !== player.id ? (
                        <div
                            key={i}
                            className="flex align-items-center gap-5 mt-3"
                        >
                            <div className="flex align-items-center gap-2">
                                <Avatar
                                    icon="pi pi-user"
                                    size="normal"
                                    className="bg-primary"
                                    shape="circle"
                                />
                                {p.player?.name ?? 'Anonymous'}
                            </div>
                            <div>
                                <GameCards
                                    selected={p.selectedCards}
                                    indexes={p.selectedCards ?? []}
                                    size="sm"
                                    visible
                                />
                            </div>
                            <div>{renderSpeed(p.speed)}</div>
                        </div>
                    ) : null
                )}
            </div>
        </>
    );
};
