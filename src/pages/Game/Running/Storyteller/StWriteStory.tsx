import React, { useState } from 'react';
import {
    usePlayerTurn,
    usePreviousStory,
    useTurn,
} from '../../../../state/gameHooks';
import { GameCards } from '../../../../components/GameCards';
import { Countdown } from '../../../../components/Countdown';
import { useUnit } from 'effector-react';
import { $player } from '../../../../state/player';
import { FloatLabel } from 'primereact/floatlabel';
import { InputTextarea } from 'primereact/inputtextarea';
import { Button } from 'primereact/button';
import { PlayersStatus } from '../PlayersStatus';
import { updatePlayersTurn } from '../../../../state/game';

export const StWriteStory: React.FC = () => {
    const player = useUnit($player);
    const turn = useTurn();
    const playerTurn = usePlayerTurn();
    const previousStory = usePreviousStory();
    const [storyValue, setStoryValue] = useState<string>(
        playerTurn?.story ?? ''
    );

    if (!player || !playerTurn) return null;

    const onStoryWritten = () =>
        updatePlayersTurn({
            [player.id]: {
                playerId: player.id,
                story:
                    storyValue ||
                    'A wild sleepy player appeared but too lazy to write a story they ran away.',
            },
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
                    {playerTurn.story ? (
                        <>
                            <i className="pi pi-pen-to-square bg-primary text-2xl p-1 border-round-xl" />{' '}
                            {playerTurn.story}
                        </>
                    ) : (
                        <>
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
                                        Write a short story from the cards
                                    </label>
                                </FloatLabel>
                            </div>
                        </>
                    )}
                </div>
                {!playerTurn.story && (
                    <div className="text-right mt-2">
                        <Button size="small" onClick={onStoryWritten}>
                            Continue
                        </Button>
                    </div>
                )}
                {turn?.status !== 'stWriteStory' && (
                    <div className="mt-5">
                        <PlayersStatus />
                    </div>
                )}
            </div>
        </div>
    );
};
