import React from 'react';
import { GameCard } from '../GameCard';
import './styles.css';

interface GameCardsProps {
    indexes: number[];
    visible?: boolean;
    onSelect?: (index: number) => void;
    selected?: number[];
    limit?: number;
}

export const GameCards: React.FC<GameCardsProps> = ({
    indexes,
    visible,
    onSelect,
    selected,
    limit,
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
