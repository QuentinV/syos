import React from 'react';
import { useChorusSession } from '../../context';
import { QRCode } from '../QRCode';
import './styles.css';

export interface SessionLobbyParticipant {
    id: string;
    name: string;
    ready: boolean;
}

export interface SessionLobbyProps {
    participants: SessionLobbyParticipant[];
    currentParticipantId?: string;
    onToggleReady: (participantId: string) => void;
    onStart: () => void;
    canStart: boolean;
}

export const SessionLobby: React.FC<SessionLobbyProps> = ({
    participants,
    currentParticipantId,
    onToggleReady,
    onStart,
    canStart,
}) => {
    const { sessionId, peerId } = useChorusSession();

    return (
        <div className="chorus-lobby">
            <h2 className="chorus-lobby-title">Session room {sessionId}</h2>

            {peerId && (
                <div className="chorus-lobby-join">
                    <div className="chorus-lobby-join-text">
                        Participants can join with QRCode or click to copy URL
                    </div>
                    <div className="chorus-lobby-join-qr">
                        <QRCode />
                    </div>
                </div>
            )}

            <div className="chorus-lobby-controls">
                <div className="chorus-lobby-participants-label">
                    Participants
                </div>
                {currentParticipantId && (
                    <div className="chorus-lobby-buttons">
                        <button
                            className="chorus-lobby-btn"
                            onClick={() => onToggleReady(currentParticipantId)}
                        >
                            Ready
                        </button>{' '}
                        <button
                            className="chorus-lobby-btn chorus-lobby-btn-primary"
                            disabled={!canStart}
                            onClick={onStart}
                        >
                            Start Session
                        </button>
                    </div>
                )}
            </div>

            <div className="chorus-lobby-participants-list">
                <table>
                    <tbody>
                        {participants.map((p) => (
                            <tr key={p.id}>
                                <td className="chorus-lobby-participant-name">
                                    {p.name}
                                    {p.id === currentParticipantId
                                        ? ' (you)'
                                        : ''}
                                </td>
                                <td className="chorus-lobby-participant-status">
                                    {p.ready ? 'Ready' : 'Not ready'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
