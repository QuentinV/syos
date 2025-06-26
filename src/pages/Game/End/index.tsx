import React from 'react';
import { useGame } from '../../../state/game';
import { PlayersBoard } from '../../../components/PlayersBoard';
import { PlayerRole } from '../../../state/types';
import { Button } from 'primereact/button';
import { newGameFx } from '../../../state/init';

export const End: React.FC = () => {
    const game = useGame();

    if (!game) return null;

    return (
        <div className="flex align-items-center justify-content-center flex-column">
            <h2 className="text-primary">Game is finished</h2>
            <PlayersBoard />
            <div className="w-full">
                <h2>Full story:</h2>
                <div className="ml-3">
                    {game?.turns?.map((t) => (
                        <div>
                            {Object.keys(t?.players ?? {})
                                .filter(
                                    (pk) =>
                                        t?.players?.[pk ?? '']?.role ===
                                        PlayerRole.storyteller
                                )
                                ?.map((pk) => t?.players?.[pk ?? '']?.story)
                                ?.filter((s) => !!s)
                                ?.join('.')}
                            .
                        </div>
                    ))}
                </div>
            </div>
            <Button className="mt-5" onClick={() => newGameFx()}>
                New game
            </Button>
        </div>
    );
};
