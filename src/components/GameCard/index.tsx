import React from 'react';
import './styles.css';
import { Image } from 'primereact/image';

interface GameCardProps {
    index: number;
    visible?: boolean;
    onSelect?: (index: number) => void;
    selected?: boolean;
}

export const GameCard: React.FC<GameCardProps> = ({
    index,
    visible,
    onSelect,
    selected,
}) => {
    return (
        <div
            className={`gamecard ${!visible && !selected ? 'backcard' : ''} ${selected ? 'selected' : ''}`}
            onClick={() => !visible && onSelect?.(index)}
        >
            <Image
                src={
                    visible || selected
                        ? `images/${index}.png`
                        : 'cards_backs/3.png'
                }
                width="120"
                height="160"
            />
        </div>
    );
};
