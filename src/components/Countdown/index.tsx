import React, { useEffect, useState } from 'react';
import { Knob } from 'primereact/knob';

interface CountdownProps {
    limit: number; // seconds
    onComplete: () => void;
}

export const Countdown: React.FC<CountdownProps> = ({ limit }) => {
    const [value, setValue] = useState<number>(limit);

    useEffect(() => {
        if (value > 0) {
            setTimeout(() => setValue(value - 1), 1000);
        }
    }, [value]);

    return (
        <>
            <Knob
                value={value}
                min={0}
                max={limit}
                size={75}
                strokeWidth={5}
                readOnly
            />
        </>
    );
};
