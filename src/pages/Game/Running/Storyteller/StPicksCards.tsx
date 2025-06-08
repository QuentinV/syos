import React, { useEffect, useState } from 'react';
import { usePlayerTurn } from '../../../../state/gameHooks';
import { GameCards } from '../../../../components/GameCards';
import { selectCard } from '../../../../state/game';
import { useUnit } from 'effector-react';
import { $player } from '../../../../state/player';

export const StPicksCards: React.FC = () => {
    const playerTurn = usePlayerTurn();
    const [cardsVisible, setCardsVisible] = useState<boolean>(true);
    const player = useUnit($player);

    useEffect(() => {
        if (playerTurn?.displayedCards?.length) {
            setTimeout(() => {
                setCardsVisible(false);
            }, 2000);
        }
    }, [playerTurn?.displayedCards]);

    if (!player || !playerTurn) return null;

    const onSelectCard = (index: number) => {
        console.log('select card', index);
        selectCard({ cardIndex: index, playerId: player!.id });
    };

    return (
        <>
            {playerTurn.displayedCards?.length && (
                <div>
                    <div>
                        Selected: {playerTurn?.selectedCards?.length ?? 0} / 3
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
