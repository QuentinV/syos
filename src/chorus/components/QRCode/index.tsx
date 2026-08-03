import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import './styles.css';

export interface QRCodeProps {
    value: string;
    bgColor?: string;
    fgColor?: string;
    title?: string;
    className?: string;
    onClick?: () => void;
}

export const QRCode: React.FC<QRCodeProps> = ({
    value,
    bgColor,
    fgColor,
    title,
    className,
    onClick,
}) => {
    return (
        <QRCodeSVG
            value={value}
            bgColor={bgColor}
            fgColor={fgColor}
            title={title}
            className={`chorus-qrcode ${className ?? ''}`}
            onClick={onClick}
        />
    );
};
