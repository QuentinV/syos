import React, { useEffect, useState } from 'react';
import { useUnit } from 'effector-react';
import { $gameTurnStatus, setDisplayedCards } from '../../../../state/game';
import cardsMapping from '../../../../cards_mapping.json';
import { $player } from '../../../../state/player';
import { usePlayerTurn, useTurn } from '../../../../state/gameHooks';
import { StPicksCards } from './StPicksCards';
import { StWriteStory } from './StWriteStory';

const getRandomCards = (cards: number[], limit: number) => {
    const result = [];
    for (let i = 0; i < limit; ++i) {
        result.push(cards[Math.floor(Math.random() * cards.length)]);
    }
    return result;
};

export const Storyteller: React.FC = () => {
    const gameTurnStatus = useUnit($gameTurnStatus);
    const player = useUnit($player);
    const turn = useTurn();
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

    if (!player || !turn || !playerTurn) return null;

    const renderContent = () => {
        switch (turn.status) {
            case 'stPicksCards':
                return <StPicksCards />;
            case 'stWriteStory':
                return <StWriteStory />;
        }
    };

    return (
        <>
            <div>STATUS: {gameTurnStatus}</div>
            {renderContent()}
        </>
    );
};
