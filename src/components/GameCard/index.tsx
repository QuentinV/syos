import React from 'react';
import { Image } from 'primereact/image';

interface GameCardProps {
    index: number;
    key?: string;
}

export const GameCard: React.FC<GameCardProps> = ({ index, key }) => {
    return (
        <>
            <Image
                src={`images/${index}.png`}
                key={key}
                width="120"
                height="160"
            />
        </>
    );
};
