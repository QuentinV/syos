import React from 'react';
import './styles.css';

export interface JoinSessionProps {
    sessionId: string;
    peerId: string;
    playerName?: string;
}

export const JoinSession: React.FC<JoinSessionProps> = ({
    sessionId,
    peerId,
    playerName,
}) => {
    return (
        <div className="chorus-join">
            <h2>Hello {playerName}</h2>
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
