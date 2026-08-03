import React, { useEffect, useState } from 'react';
import './styles.css';

export interface CountdownProps {
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
    const [complete, setComplete] = useState<boolean>(false);

    useEffect(() => {
        if (value > 0) {
            setTimeout(() => setValue(value - 1), 1000);
        } else if (!complete) {
            setComplete(true);
            onComplete?.();
        }
    }, [value]);

    const radius = 30;
    const circumference = 2 * Math.PI * radius;
    const progress = value / limit;
    const dashOffset = circumference * (1 - progress);

    return (
        <>
            {style === 'knob' ? (
                <div className="chorus-countdown-knob">
                    <svg
                        width="75"
                        height="75"
                        viewBox="0 0 75 75"
                        className="chorus-countdown-svg"
                    >
                        <circle
                            className="chorus-countdown-track"
                            cx="37.5"
                            cy="37.5"
                            r={radius}
                            fill="none"
                            strokeWidth="5"
                        />
                        <circle
                            className="chorus-countdown-progress"
                            cx="37.5"
                            cy="37.5"
                            r={radius}
                            fill="none"
                            strokeWidth="5"
                            strokeDasharray={circumference}
                            strokeDashoffset={dashOffset}
                            strokeLinecap="round"
                            transform="rotate(-90 37.5 37.5)"
                        />
                    </svg>
                    <span className="chorus-countdown-value">{value}</span>
                </div>
            ) : (
                <div className="chorus-countdown-bar">
                    <div className="chorus-countdown-bar-track">
                        <div
                            className="chorus-countdown-bar-fill"
                            style={{ width: `${progress * 100}%` }}
                        />
                    </div>
                    <span className="chorus-countdown-bar-value">{value}</span>
                </div>
            )}
        </>
    );
};
