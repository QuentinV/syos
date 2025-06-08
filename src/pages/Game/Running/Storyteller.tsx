import React, { useEffect, useState } from 'react';
import { useUnit } from 'effector-react';
import {
    $gameTurnStatus,
    selectCard,
    setDisplayedCards,
} from '../../../state/game';
import cardsMapping from '../../../cards_mapping.json';
import { GameCards } from '../../../components/GameCards';
import { $player } from '../../../state/player';
import { usePlayerTurn } from '../../../state/gameHooks';

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
    const playerTurn = usePlayerTurn();

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

    const onSelectCard = (index: number) => {
        console.log('select card', index);
        selectCard({ cardIndex: index, playerId: player!.id });
    };

    if (!player) return null;

    return (
        <>
            <div>STATUS: {gameTurnStatus}</div>
            {playerTurn?.displayedCards?.length && (
                <div>
                    <GameCards
                        indexes={playerTurn.displayedCards}
                        visible={cardsVisible}
                        onSelect={onSelectCard}
                        selected={playerTurn.selectedCards}
                    />
                </div>
            )}
        </>
    );
};
