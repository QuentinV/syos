import React, { useState } from 'react';
import { usePlayerTurn, usePreviousStory } from '../../../../state/gameHooks';
import { GameCards } from '../../../../components/GameCards';
import { Countdown } from '../../../../components/Countdown';
import { writeStory } from '../../../../state/game';
import { useUnit } from 'effector-react';
import { $player } from '../../../../state/player';
import { FloatLabel } from 'primereact/floatlabel';
import { InputTextarea } from 'primereact/inputtextarea';
import { Button } from 'primereact/button';

export const StWriteStory: React.FC = () => {
    const player = useUnit($player);
    const playerTurn = usePlayerTurn();
    const previousStory = usePreviousStory();
    const [storyValue, setStoryValue] = useState<string>('');

    if (!player || !playerTurn) return null;

    const onStoryWritten = () =>
        writeStory({
            playerId: player.id,
            story:
                storyValue ||
                'A wild sleepy player appeared but too lazy to write a story they ran away.',
        });

    return (
        <div className="flex">
            <div>
                <GameCards
                    indexes={playerTurn.selectedCards ?? []}
                    selected={playerTurn.selectedCards}
                    visible
                />
                {!!previousStory && <div className="mt-2">{previousStory}</div>}
                <div className="flex mt-6 align-items-center gap-3">
                    <div>
                        <Countdown
                            limit={60}
                            onComplete={() => onStoryWritten()}
                        />
                    </div>
                    <div className="flex-1">
                        <FloatLabel>
                            <InputTextarea
                                id="stWriteStoryInput"
                                value={storyValue}
                                onChange={(event) =>
                                    setStoryValue(event.target.value)
                                }
                            />
                            <label htmlFor="stWriteStoryInput">
                                Write your own short story
                            </label>
                        </FloatLabel>
                    </div>
                </div>
                <div className="text-right mt-2">
                    <Button size="small" onClick={onStoryWritten}>
                        Continue
                    </Button>
                </div>
            </div>
        </div>
    );
};
