import React, { useState } from 'react';
import { $participant, gameEvents } from '../../../../state/game';
import { usePreviousStory } from '../../../../state/gameHooks';
import { GameCards } from '../../../../components/GameCards';
import { Countdown, useLocalParticipantTurn, useTurn } from '@quentinv/chorus';
import { useUnit } from 'effector-react';
import { FloatLabel } from 'primereact/floatlabel';
import { InputTextarea } from 'primereact/inputtextarea';
import { Button } from 'primereact/button';
import { PlayersStatus } from '../PlayersStatus';

export const StWriteStory: React.FC = () => {
    const player = useUnit($participant);
    const turn = useTurn();
    const playerTurn = useLocalParticipantTurn();
    const previousStory = usePreviousStory();
    const [storyValue, setStoryValue] = useState<string>(
        playerTurn?.story ?? ''
    );

    if (!player || !playerTurn) return null;

    const onStoryWritten = () =>
        gameEvents.updateTurnParticipants({
            [player.id]: {
                playerId: player.id,
                story:
                    storyValue ||
                    'A wild sleepy player appeared but too lazy to write a story they ran away.',
                selectedCardsTime: Date.now(),
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
