import React from 'react';
import { usePlayersTurn, useTurn } from '../../../../state/gameHooks';
import { useUnit } from 'effector-react';
import { $player } from '../../../../state/player';

export const PlayersStatus: React.FC = () => {
    const players = usePlayersTurn();
    const player = useUnit($player);

    if (!player || !players?.length) return null;

    return (
        <>
            <div>Hold on while other players are guessing</div>
            <div>
                {players.map((p, i) =>
                    p.playerId !== player.id ? (
                        <div key={i} className="flex">
                            <div>{p.player?.name}</div>
                            <div>{p.displayedCards?.join(', ')}</div>
                            <div>{p.selectedCards?.join(', ')}</div>
                        </div>
                    ) : null
                )}
            </div>
        </>
    );
};
