import React from 'react';
import { useUnit } from 'effector-react';
import { useChorusSession, useSessionState } from '../../core/context';
import { useLocalParticipant } from '../../turn';
import { Participant, TurnSessionState } from '../../turn';
import type { EventCallable } from 'effector';
import { QRCode } from '../QRCode';
import './styles.css';

export interface SessionLobbyParticipant {
    id: string;
    name: string;
    ready: boolean;
}

export const SessionLobby: React.FC = () => {
    const { sessionId, $peerId, events } = useChorusSession();
    const peerId = useUnit($peerId);
    const state = useSessionState<TurnSessionState<string, any> | null>();
    const localParticipant = useLocalParticipant();

    const participants: SessionLobbyParticipant[] = state
        ? Object.keys(state.participants).map((key) => ({
              id: state.participants[key].id,
              name: state.participants[key].name,
              ready: state.participants[key].ready,
          }))
        : [];

    const currentParticipantId = localParticipant?.id;
    const canStart =
        !!state &&
        !Object.keys(state.participants).some(
            (pk) => !state.participants[pk].ready
        );
    const onToggleReady = (participantId: string) => {
        const toggleReady = events[
            'toggleParticipantReady'
        ] as EventCallable<string>;
        toggleReady(participantId);
    };
    const onStart = () => {
        const start = events['startSession'] as EventCallable<void>;
        start();
    };

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
