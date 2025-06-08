import React from 'react';
import { GameCard } from '../GameCard';
import './styles.css';

interface GameCardsProps {
    indexes: number[];
    visible?: boolean;
}

export const GameCards: React.FC<GameCardsProps> = ({ indexes, visible }) => {
    return (
        <div className="gamecards">
            {indexes.map((i) => (
                <GameCard index={i} key={String(i)} />
            ))}
        </div>
    );
};
