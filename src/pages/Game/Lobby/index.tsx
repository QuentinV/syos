import React from 'react';
import { useUnit } from 'effector-react';
import {
    startGame,
    togglePlayerReady,
    useGame,
    usePeerId,
} from '../../../state/game';
import { $player } from '../../../state/player';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from 'primereact/button';

const process: any = undefined;

const getJoinUrl = (gameId: string, peerId: string) =>
    `${document.location.origin}/syos#/game/${gameId}/join/${peerId}`;

export const Lobby: React.FC = () => {
    const game = useGame();
    const player = useUnit($player);
    const peerId = usePeerId();

    if (!game || !peerId) return null;

    return (
        <>
            <h2 className="text-center">Game room {game.id}</h2>
            {peerId && (
                <div className="text-center m-5">
                    <div>Players can join with QRCode or click to copy URL</div>
                    <div className="m-2">
                        <QRCodeSVG
                            value={getJoinUrl(game.id, peerId)}
                            bgColor="var(--surface-ground)"
                            fgColor="var(--primary-color)"
                            title="Connect to game QRCode"
                            className="cursor-pointer"
                            onClick={() =>
                                navigator.clipboard.writeText(
                                    getJoinUrl(game.id, peerId)
                                )
                            }
                        />
                    </div>
                </div>
            )}
            <div className="flex p-4 justify-content-center">
                <div className="w-4">
                    <div>Players</div>
                </div>
                {player && (
                    <div>
                        <Button
                            label="Ready"
                            size="small"
                            onClick={() => togglePlayerReady(player.id)}
                        />{' '}
                        <Button
                            label="Start Game"
                            size="small"
                            disabled={Object.keys(game.players).some(
                                (pk) => !game.players[pk].ready
                            )}
                            onClick={() => startGame()}
                        />
                    </div>
                )}
            </div>
            <div className="flex justify-content-center">
                <table>
                    <tbody>
                        {Object.keys(game.players).map((key) => {
                            const p = game.players[key];
                            return (
                                <tr key={p.id}>
                                    <td className="pr-5 pb-3">
                                        {p.name}
                                        {p.id === player?.id ? ' (you)' : ''}
                                    </td>
                                    <td className="pb-3">
                                        {p.ready ? 'Ready' : 'Not ready'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </>
    );
};
