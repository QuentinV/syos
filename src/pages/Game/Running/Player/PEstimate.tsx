import React, { useState } from 'react';
import { GameCard } from '../../../../components/GameCard';
import { InputNumber } from 'primereact/inputnumber';
import { Button } from 'primereact/button';
import { useUnit } from 'effector-react';
import { $player } from '../../../../state/player';
import { setTimeEstimate } from '../../../../state/game';
import { usePlayerTurn } from '../../../../state/gameHooks';

export const PEstimate: React.FC = () => {
    const [estimated, setEstimated] = useState<number>(20);
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
                <div className="w-9rem">
                    <InputNumber
                        value={playerTurn?.estimateVisibleCards ?? estimated}
                        onValueChange={(event) =>
                            setEstimated(event.value ?? 0)
                        }
                        min={1}
                        showButtons
                        buttonLayout="horizontal"
                        disabled={!!playerTurn?.estimateVisibleCards}
                    />
                </div>
                <div>seconds</div>
            </div>
            {!playerTurn?.estimateVisibleCards && (
                <div>
                    <Button
                        size="small"
                        onClick={() =>
                            setTimeEstimate({
                                playerId: player.id,
                                estimate: estimated,
                            })
                        }
                    >
                        Lock my decision
                    </Button>
                </div>
            )}
        </div>
    );
};
