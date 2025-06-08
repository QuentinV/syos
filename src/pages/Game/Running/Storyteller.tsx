import React, { useEffect, useState } from 'react';
import { useUnit } from 'effector-react';
import {
    $gameTurnStatus,
    selectCard,
    setDisplayedCards,
    writeStory,
} from '../../../state/game';
import cardsMapping from '../../../cards_mapping.json';
import { GameCards } from '../../../components/GameCards';
import { $player } from '../../../state/player';
import {
    usePlayerTurn,
    usePreviousStory,
    useTurn,
} from '../../../state/gameHooks';
import { InputTextarea } from 'primereact/inputtextarea';
import { Button } from 'primereact/button';
import { FloatLabel } from 'primereact/floatlabel';
import { Countdown } from '../../../components/Countdown';

const getRandomCards = (cards: number[], limit: number) => {
    const result = [];
    for (let i = 0; i < limit; ++i) {
        result.push(cards[Math.floor(Math.random() * cards.length)]);
    }
    return result;
};

export const Storyteller: React.FC = () => {
    const gameTurnStatus = useUnit($gameTurnStatus);
    const [cardsVisible, setCardsVisible] = useState<boolean>(true);
    const player = useUnit($player);
    const turn = useTurn();
    const playerTurn = usePlayerTurn();
    const previousStory = usePreviousStory();
    const [storyValue, setStoryValue] = useState<string>('');

    useEffect(() => {
        if (!playerTurn?.displayedCards?.length) {
            const r = [
                ...getRandomCards(cardsMapping.activity, 3),
                ...getRandomCards(cardsMapping.landscape, 3),
                ...getRandomCards(cardsMapping.animals, 3),
            ];
            setDisplayedCards({ playerId: player!.id, cardIndexes: r });
        }
    }, [playerTurn?.displayedCards]);

    useEffect(() => {
        if (playerTurn?.displayedCards?.length) {
            setTimeout(() => {
                setCardsVisible(false);
            }, 2000);
        }
    }, [playerTurn?.displayedCards]);

    if (!player || !turn || !playerTurn) return null;

    const onSelectCard = (index: number) => {
        console.log('select card', index);
        selectCard({ cardIndex: index, playerId: player!.id });
    };

    const onStoryWritten = () =>
        writeStory({ playerId: player.id, story: storyValue });

    const renderContent = () => {
        switch (turn.status) {
            case 'stPicksCards':
                return (
                    playerTurn.displayedCards?.length && (
                        <div>
                            <div>
                                Selected:{' '}
                                {playerTurn?.selectedCards?.length ?? 0} / 3
                            </div>
                            <GameCards
                                indexes={playerTurn.displayedCards}
                                visible={cardsVisible}
                                onSelect={onSelectCard}
                                selected={playerTurn.selectedCards}
                                limit={3}
                            />
                        </div>
                    )
                );
            case 'stWriteStory':
                return (
                    <div className="flex">
                        <div>
                            <GameCards
                                indexes={playerTurn.selectedCards ?? []}
                                selected={playerTurn.selectedCards}
                                visible
                            />
                            {!!previousStory && (
                                <div className="mt-2">{previousStory}</div>
                            )}
                            <div className="flex mt-6 align-items-center gap-3">
                                <div>
                                    <Countdown
                                        limit={60}
                                        onComplete={() =>
                                            console.log('completed')
                                        }
                                    />
                                </div>
                                <div className="flex-1">
                                    <FloatLabel>
                                        <InputTextarea
                                            id="stWriteStoryInput"
                                            value={storyValue}
                                            onChange={(event) =>
                                                setStoryValue(
                                                    event.target.value
                                                )
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
        }
    };

    return (
        <>
            <div>STATUS: {gameTurnStatus}</div>
            {renderContent()}
        </>
    );
};
