import React from 'react';
import { useUnit } from 'effector-react';
import { QRCodeSVG } from 'qrcode.react';
import { useChorusSession } from '../../core/context';
import './styles.css';

export interface QRCodeProps {
    bgColor?: string;
    fgColor?: string;
    title?: string;
    className?: string;
}

export const QRCode: React.FC<QRCodeProps> = ({
    bgColor,
    fgColor,
    title,
    className,
}) => {
    const { sessionId, getJoinUrl, $peerId } = useChorusSession();
    const peerId = useUnit($peerId);
    if (!peerId) return null;
    const url = getJoinUrl(sessionId, peerId);

    return (
        <QRCodeSVG
            value={url}
            bgColor={bgColor}
            fgColor={fgColor}
            title={title}
            className={`chorus-qrcode ${className ?? ''}`}
            onClick={() => navigator.clipboard?.writeText(url)}
        />
    );
};
