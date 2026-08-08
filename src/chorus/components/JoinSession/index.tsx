import React from 'react';
import './styles.css';

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
