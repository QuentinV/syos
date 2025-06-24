import React, { useEffect, useState } from 'react';
import { usePlayerTurn, useStorytellerTurn } from '../../../../state/gameHooks';
import { useUnit } from 'effector-react';
import { $player } from '../../../../state/player';
import { selectCard, updatePlayersTurn } from '../../../../state/game';
import { GameCards } from '../../../../components/GameCards';

export const PPicksCards: React.FC = () => {
    const playerTurn = usePlayerTurn();
    const [cardsVisible, setCardsVisible] = useState<boolean>(true);
    const player = useUnit($player);
    const storytellerTurn = useStorytellerTurn();

    useEffect(() => {
        if (playerTurn?.displayedCards?.length) {
            setTimeout(() => {
                setCardsVisible(false);
            }, 2000);
        }
    }, [playerTurn?.displayedCards]);

    if (!player || !playerTurn || !storytellerTurn) return null;

    const onSelectCard = (index: number) => {
        console.log('select card', index);
        selectCard({ cardIndex: index, playerId: player!.id });
        if (playerTurn.selectedCards?.length === 3) {
            updatePlayersTurn({
                [player.id]: {
                    playerId: player!.id,
                    selectedCardsTime: new Date().getTime(),
                },
            });
        }
    };

    return (
        <>
            {!cardsVisible && <div>Story: {storytellerTurn.story}</div>}
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
