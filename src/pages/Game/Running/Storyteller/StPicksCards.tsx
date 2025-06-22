import React, { useEffect, useState } from 'react';
import { usePlayerTurn } from '../../../../state/gameHooks';
import { GameCards } from '../../../../components/GameCards';
import { selectCard } from '../../../../state/game';
import { useUnit } from 'effector-react';
import { $player } from '../../../../state/player';
import { Countdown } from '../../../../components/Countdown';

export const StPicksCards: React.FC = () => {
    const playerTurn = usePlayerTurn();
    const [cardsVisible, setCardsVisible] = useState<boolean>(true);
    const player = useUnit($player);

    if (!player || !playerTurn) return null;

    const onSelectCard = (index: number) => {
        selectCard({ cardIndex: index, playerId: player!.id });
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
                                    limit={10}
                                    onComplete={() => setCardsVisible(false)}
                                    style="bar"
                                />
                            </>
                        ) : (
                            <div>Pick 3 cards!</div>
                        )}
                    </div>

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
