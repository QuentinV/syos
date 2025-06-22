import React from 'react';
import { GameCard } from '../GameCard';
import './styles.css';

interface GameCardsProps {
    indexes: number[];
    visible?: boolean;
    onSelect?: (index: number) => void;
    selected?: number[];
    limit?: number;
    size?: 'sm' | 'md';
}

export const GameCards: React.FC<GameCardsProps> = ({
    indexes,
    visible,
    onSelect,
    selected,
    limit,
    size = 'md',
}) => {
    return (
        <div
            className="gamecards"
            style={{
                gridTemplateRows: `repeat(${Math.ceil(indexes.length / 3)}, 1fr)`,
            }}
        >
            {indexes.map((k, i) => (
                <GameCard
                    index={k}
                    key={String(i)}
                    size={size}
                    visible={visible || selected?.includes(k)}
                    onSelect={
                        !visible && (!limit || (selected?.length ?? 0) < limit)
                            ? onSelect
                            : undefined
                    }
                    selected={selected?.includes(k)}
                />
            ))}
        </div>
    );
};
