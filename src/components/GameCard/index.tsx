import React from 'react';
import './styles.css';
import { Image } from 'primereact/image';

interface GameCardProps {
    index: number;
    visible?: boolean;
    onSelect?: (index: number) => void;
    selected?: boolean;
    size?: 'sm' | 'md';
}

export const GameCard: React.FC<GameCardProps> = ({
    index,
    visible,
    onSelect,
    selected,
    size = 'md',
}) => {
    const width = size === 'md' ? 120 : 60;
    const height = size === 'md' ? 160 : 80;

    return (
        <div
            className={`gamecard${!visible ? ' backcard' : ''}${onSelect && !selected ? ' selectable' : ''}${selected ? ' selected' : ''} ${size}`}
            onClick={() => !visible && onSelect?.(index)}
        >
            <Image
                src={visible ? `images/${index}.png` : 'cards_backs/3.png'}
                width={String(width)}
                height={String(height)}
            />
        </div>
    );
};
