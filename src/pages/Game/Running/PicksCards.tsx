import React, { useState } from 'react';
import { usePlayerTurn, useStorytellerTurn } from '../../../state/gameHooks';
import { GameCards } from '../../../components/GameCards';
import { selectCard, updatePlayersTurn } from '../../../state/game';
import { useUnit } from 'effector-react';
import { $player } from '../../../state/player';
import { Countdown } from '../../../components/Countdown';
import { Button } from 'primereact/button';

export const PicksCards: React.FC = () => {
    const playerTurn = usePlayerTurn();
    const [cardsVisible, setCardsVisible] = useState<boolean>(true);
    const player = useUnit($player);
    const storytellerTurn = useStorytellerTurn();

    if (!player || !playerTurn) return null;

    const onSelectCard = (index: number) => {
        selectCard({ cardIndex: index, playerId: player!.id });
        if (playerTurn.selectedCards?.length === 3) {
            updatePlayersTurn({
                [player.id]: {
                    playerId: player!.id,
                    selectedCardsTime: Date.now(),
                },
            });
        }
    };

    return (
        <>
            {playerTurn.displayedCards?.length && (
                <div>
                    <div className="flex align-items-center gap-5 mb-3">
                        <div>
                            Selected: {playerTurn?.selectedCards?.length ?? 0} /
                            3
                        </div>
                        {cardsVisible ? (
                            <>
                                <div>Memorize cards before count is down</div>
                                <Countdown
                                    limit={
                                        playerTurn.estimateVisibleCards ?? 10
                                    }
                                    onComplete={() => setCardsVisible(false)}
                                    style="bar"
                                />
                            </>
                        ) : (
                            <div>Pick 3 cards!</div>
                        )}
                    </div>

                    {cardsVisible && storytellerTurn?.story && (
                        <div className="text-center my-4">
                            <Button
                                onClick={() => setCardsVisible(false)}
                                label="I memorized all give me more points"
                                size="small"
                            />
                        </div>
                    )}

                    {!cardsVisible && storytellerTurn?.story && (
                        <div>Story: {storytellerTurn?.story}</div>
                    )}

                    <GameCards
                        indexes={playerTurn.displayedCards}
                        visible={cardsVisible}
                        onSelect={onSelectCard}
                        selected={playerTurn.selectedCards}
                        limit={3}
                    />
                </div>
            )}
        </>
    );
};
