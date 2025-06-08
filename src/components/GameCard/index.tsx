import React from 'react';
import './styles.css';
import { Image } from 'primereact/image';

interface GameCardProps {
    index: number;
    key?: string;
    visible?: boolean;
}

export const GameCard: React.FC<GameCardProps> = ({ index, key, visible }) => {
    return (
        <div className="gamecard">
            <Image
                src={visible ? `images/${index}.png` : 'cards_backs/3.png'}
                key={key}
                width="120"
                height="160"
            />
        </div>
    );
};
