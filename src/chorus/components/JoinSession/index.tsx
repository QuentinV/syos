import React, { useEffect } from 'react';
import './styles.css';
import { useChorusSession } from '../../context';

export interface JoinSessionProps {
    sessionId?: string;
    peerId?: string;
    participantName?: string;
}

export const JoinSession: React.FC<JoinSessionProps> = ({
    sessionId,
    peerId,
    participantName,
}) => {
    const joinFx = useChorusSession().joinFx;

    useEffect(() => {
        if (!peerId || !sessionId) {
            return;
        }
        joinFx({ objectId: sessionId, peerId });
    }, [sessionId, peerId]);

    if (!peerId || !sessionId) return null;

    return (
        <div className="chorus-join">
            <h2>Hello {participantName}</h2>
            <div>
                You are being connected
                <div className="chorus-join-info">- Session {sessionId}</div>
                <div className="chorus-join-info">- Peer {peerId}</div>
            </div>
            <div className="chorus-join-progress">
                <div className="chorus-join-spinner" />
                <span className="chorus-join-progress-text">
                    Please hold on
                </span>
            </div>
        </div>
    );
};
