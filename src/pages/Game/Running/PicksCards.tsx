import React, { useState } from 'react';
import { usePlayerTurn, useStorytellerTurn } from '../../../state/gameHooks';
import { GameCards } from '../../../components/GameCards';
import { gameEvents } from '../../../state/game';
import { useUnit } from 'effector-react';
import { $participant } from '../../../state/player';
import { Countdown } from '../../../chorus';
import { Button } from 'primereact/button';

export const PicksCards: React.FC = () => {
    const playerTurn = usePlayerTurn();
    const [cardsVisible, setCardsVisible] = useState<boolean>(true);
    const participant = useUnit($participant);
    const storytellerTurn = useStorytellerTurn();

    if (!participant || !playerTurn) return null;

    const onSelectCard = (index: number) => {
        gameEvents.selectCard({ cardIndex: index, playerId: participant!.id });
        if (playerTurn.selectedCards?.length === 3) {
            gameEvents.updateTurnParticipants({
                [participant.id]: {
                    playerId: participant!.id,
                    selectedCardsTime: Date.now(),
                },
            });
        }
    };

    return (
        <>
            {playerTurn.displayedCards?.length && (
                <div>
                    <div className="flex align-items-center gap-5 mb-3 flex-wrap">
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
