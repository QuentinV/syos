import React from 'react';
import './styles.css';
import { Image } from 'primereact/image';

interface GameCardProps {
    index: number;
    visible?: boolean;
    onSelect?: (index: number) => void;
    selected?: boolean;
    size?: 'sm' | 'md';
    valid?: boolean;
}

export const GameCard: React.FC<GameCardProps> = ({
    index,
    visible,
    onSelect,
    selected,
    size = 'md',
    valid,
}) => {
    return (
        <div
            className={`gamecard${!visible ? ' backcard' : ''}${onSelect && !selected ? ' selectable' : ''}${selected ? ` selected ${valid === true ? 'valid' : valid === false ? 'invalid' : ''}` : ''} ${size}`}
            onClick={() => !visible && onSelect?.(index)}
        >
            <Image
                src={
                    visible
                        ? `/syos/images/${index}.png`
                        : '/syos/cards_backs/3.png'
                }
            />
        </div>
    );
};
