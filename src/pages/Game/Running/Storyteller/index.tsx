import React, { useEffect } from 'react';
import { useUnit } from 'effector-react';
import { gameEvents } from '../../../../state/game';
import cardsMapping from '../../../../cards_mapping.json';
import { $participant } from '../../../../state/player';
import { useActiveParticipant, useTurn } from '../../../../state/game';
import { PicksCards } from '../PicksCards';
import { StWriteStory } from './StWriteStory';
import { getRandomCards } from '../../../../utils/getRandomCards';
import { TurnEnded } from '../TurnEnded';

export const Storyteller: React.FC = () => {
    const participant = useUnit($participant);
    const turn = useTurn();
    const playerTurn = useActiveParticipant();

    useEffect(() => {
        if (!playerTurn?.displayedCards?.length) {
            const r = [
                ...getRandomCards(cardsMapping.activity, 3),
                ...getRandomCards(cardsMapping.landscape, 3),
                ...getRandomCards(cardsMapping.animals, 3),
            ];
            gameEvents.setDisplayedCards({
                playerId: participant!.id,
                cardIndexes: r,
            });
        }
    }, [playerTurn?.displayedCards]);

    if (!participant || !turn || !playerTurn) return null;

    const renderContent = () => {
        switch (turn.status) {
            case 'stPicksCards':
                return <PicksCards />;
            case 'stWriteStory':
            case 'pEstimate':
            case 'pPicksCards':
                return <StWriteStory />;
            case 'turnEnded':
                return <TurnEnded />;
        }
    };

    return <>{renderContent()}</>;
};
