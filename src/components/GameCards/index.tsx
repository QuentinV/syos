import React from 'react';
import { GameCard } from '../GameCard';
import './styles.css';

interface GameCardsProps {
    indexes: number[];
    visible?: boolean;
    onSelect?: (index: number) => void;
    selected?: number[];
}

export const GameCards: React.FC<GameCardsProps> = ({
    indexes,
    visible,
    onSelect,
    selected,
}) => {
    return (
        <div className="gamecards">
            {indexes.map((k, i) => (
                <GameCard
                    index={k}
                    key={String(i)}
                    visible={visible}
                    onSelect={onSelect}
                    selected={selected?.includes(k)}
                />
            ))}
        </div>
    );
};
