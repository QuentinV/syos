import React from 'react';
import { GameCard } from '../GameCard';
import './styles.css';

interface GameCardsProps {
    indexes: number[];
}

export const GameCards: React.FC<GameCardsProps> = ({ indexes }) => {
    return (
        <div className="gamecards">
            {indexes.map((i) => (
                <GameCard index={i} key={String(i)} />
            ))}
        </div>
    );
};
