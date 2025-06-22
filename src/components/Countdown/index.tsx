import React, { useEffect, useState } from 'react';
import { Knob } from 'primereact/knob';
import { MeterGroup } from 'primereact/metergroup';

interface CountdownProps {
    limit: number; // seconds
    onComplete: () => void;
    style?: 'knob' | 'bar';
}

export const Countdown: React.FC<CountdownProps> = ({
    limit,
    style = 'knob',
    onComplete,
}) => {
    const [value, setValue] = useState<number>(limit);

    useEffect(() => {
        if (value > 0) {
            setTimeout(() => setValue(value - 1), 1000);
        } else {
            onComplete?.();
        }
    }, [value]);

    return (
        <>
            {style === 'knob' ? (
                <Knob
                    value={value}
                    min={0}
                    max={limit}
                    size={75}
                    strokeWidth={5}
                    readOnly
                />
            ) : (
                <div className="flex align-items-center relative">
                    <div className="w-10rem flex-1">
                        <MeterGroup
                            values={[{ value }]}
                            max={limit}
                            pt={{
                                labellist: { className: 'hidden' },
                            }}
                        />
                    </div>
                    <div
                        className="absolute bg-primary border-round-lg px-2 py-1"
                        style={{ left: '4rem' }}
                    >
                        {value}
                    </div>
                </div>
            )}
        </>
    );
};
