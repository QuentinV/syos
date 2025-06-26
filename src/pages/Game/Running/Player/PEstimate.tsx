import React, { useState } from 'react';
import { GameCard } from '../../../../components/GameCard';
import { InputNumber } from 'primereact/inputnumber';
import { Button } from 'primereact/button';
import { useUnit } from 'effector-react';
import { $player } from '../../../../state/player';
import { setTimeEstimate } from '../../../../state/game';
import { usePlayerTurn } from '../../../../state/gameHooks';

const estimateCards = [-1, 1, 2, 3, 5, 8, 10, 13, 21, 34];

export const PEstimate: React.FC = () => {
    const player = useUnit($player);
    const playerTurn = usePlayerTurn();

    if (!player?.id) return null;

    return (
        <div className="flex flex-column gap-5">
            <div>The storyteller is busy</div>
            <div className="flex ml-5 gap-5 align-items-center">
                <div>
                    <GameCard visible={false} index={0} />
                </div>
                <div>
                    <i className="pi pi-pen-to-square text-7xl text-primary" />
                </div>
            </div>
            <div>
                What do you think they will pick ? You will answer this question
                soon!
            </div>
            <div>
                Meanwhile let's estimate how long do you think you will need to
                memorize the cards?
            </div>
            <div className="flex align-items-center gap-2">
                {estimateCards.map((k) => (
                    <>
                        <Button
                            onClick={() =>
                                playerTurn?.estimateVisibleCards ===
                                    undefined &&
                                setTimeEstimate({
                                    playerId: player.id,
                                    estimate: k,
                                })
                            }
                            disabled={
                                playerTurn?.estimateVisibleCards !==
                                    undefined &&
                                playerTurn.estimateVisibleCards !== k
                            }
                        >
                            {k === -1 ? '?' : k}
                        </Button>
                    </>
                ))}
            </div>
        </div>
    );
};
