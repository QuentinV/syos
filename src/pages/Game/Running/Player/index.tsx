import { useUnit } from 'effector-react';
import React, { useEffect } from 'react';
import cardsMapping from '../../../../cards_mapping.json';
import {
    usePlayerTurn,
    useStorytellerTurn,
    useTurn,
} from '../../../../state/gameHooks';
import { $player } from '../../../../state/player';
import { getRandomCards } from '../../../../utils/getRandomCards';
import { setDisplayedCards } from '../../../../state/game';
import { PEstimate } from './PEstimate';
import { TurnEnded } from '../TurnEnded';
import { PicksCards } from '../PicksCards';

export const Player: React.FC = () => {
    const player = useUnit($player);
    const turn = useTurn();
    const playerTurn = usePlayerTurn();
    const storytellerTurn = useStorytellerTurn();

    if (!player || !turn || !playerTurn || !storytellerTurn) return null;

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
            setDisplayedCards({ playerId: player!.id, cardIndexes: r });
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
