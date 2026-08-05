import React from 'react';
import { useChorusSession } from '../../context';
import { QRCode } from '../QRCode';
import './styles.css';

export interface SessionLobbyPlayer {
    id: string;
    name: string;
    ready: boolean;
}

export interface SessionLobbyProps {
    players: SessionLobbyPlayer[];
    currentPlayerId?: string;
    onToggleReady: (playerId: string) => void;
    onStart: () => void;
    canStart: boolean;
}

export const SessionLobby: React.FC<SessionLobbyProps> = ({
    players,
    currentPlayerId,
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
                        Players can join with QRCode or click to copy URL
                    </div>
                    <div className="chorus-lobby-join-qr">
                        <QRCode />
                    </div>
                </div>
            )}

            <div className="chorus-lobby-controls">
                <div className="chorus-lobby-players-label">Players</div>
                {currentPlayerId && (
                    <div className="chorus-lobby-buttons">
                        <button
                            className="chorus-lobby-btn"
                            onClick={() => onToggleReady(currentPlayerId)}
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

            <div className="chorus-lobby-players-list">
                <table>
                    <tbody>
                        {players.map((p) => (
                            <tr key={p.id}>
                                <td className="chorus-lobby-player-name">
                                    {p.name}
                                    {p.id === currentPlayerId ? ' (you)' : ''}
                                </td>
                                <td className="chorus-lobby-player-status">
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
