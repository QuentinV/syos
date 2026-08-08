import { useUnit } from 'effector-react';
import React, { useEffect } from 'react';
import cardsMapping from '../../../../cards_mapping.json';
import { useActiveParticipant, useTurn } from '../../../../state/game';
import { useStorytellerTurn } from '../../../../state/gameHooks';
import { $participant } from '../../../../state/player';
import { getRandomCards } from '../../../../utils/getRandomCards';
import { gameEvents } from '../../../../state/game';
import { PEstimate } from './PEstimate';
import { TurnEnded } from '../TurnEnded';
import { PicksCards } from '../PicksCards';

export const Player: React.FC = () => {
    const participant = useUnit($participant);
    const turn = useTurn();
    const playerTurn = useActiveParticipant();
    const storytellerTurn = useStorytellerTurn();

    if (!participant || !turn || !playerTurn || !storytellerTurn) return null;

    useEffect(() => {
        if (
            !playerTurn?.displayedCards?.length &&
            storytellerTurn.selectedCardsTime
        ) {
            const r = [
                ...(storytellerTurn.selectedCards ?? []),
                ...getRandomCards(
                    cardsMapping.activity,
                    2,
                    storytellerTurn.selectedCards
                ),
                ...getRandomCards(
                    cardsMapping.landscape,
                    2,
                    storytellerTurn.selectedCards
                ),
                ...getRandomCards(
                    cardsMapping.animals,
                    2,
                    storytellerTurn.selectedCards
                ),
            ].sort(() => Math.random() - 0.5);
            gameEvents.setDisplayedCards({
                playerId: participant!.id,
                cardIndexes: r,
            });
        }
    }, [playerTurn?.displayedCards, storytellerTurn.selectedCardsTime]);

    const renderContent = () => {
        switch (turn.status) {
            case 'stPicksCards':
            case 'stWriteStory':
            case 'pEstimate':
                return <PEstimate />;
            case 'pPicksCards':
                return <PicksCards />;
            case 'turnEnded':
                return <TurnEnded />;
        }
    };

    return <>{renderContent()}</>;
};
