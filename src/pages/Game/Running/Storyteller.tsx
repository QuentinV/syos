import React, { useEffect, useState } from 'react';
import { useUnit } from 'effector-react';
import { $gameTurnStatus } from '../../../state/game';
import cardsMapping from '../../../cards_mapping.json';
import { GameCards } from '../../../components/GameCards';

const getRandomCards = (cards: number[], limit: number) => {
    const result = [];
    for (let i = 0; i < limit; ++i) {
        result.push(cards[Math.floor(Math.random() * cards.length)]);
    }
    return result;
};

export const Storyteller: React.FC = () => {
    const gameTurnStatus = useUnit($gameTurnStatus);
    const [displayedCards, setDisplayedCards] = useState<number[]>([]);

    useEffect(() => {
        if (!displayedCards.length) {
            const r = [
                ...getRandomCards(cardsMapping.activity, 3),
                ...getRandomCards(cardsMapping.landscape, 3),
                ...getRandomCards(cardsMapping.animals, 3),
            ];
            setDisplayedCards(r);
        }
    }, [displayedCards]);

    return (
        <>
            <div>STATUS: {gameTurnStatus}</div>
            {displayedCards.length && (
                <div>
                    <GameCards indexes={displayedCards} />
                </div>
            )}
        </>
    );
};
