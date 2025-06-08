import React from 'react';
import { useUnit } from 'effector-react';
import { $game } from '../../../state/game';
import { $player } from '../../../state/player';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from 'primereact/button';

const getJoinUrl = (gameId: string, peerId: string) =>
    `http://localhost:3000/syos#/game/${gameId}/join/${peerId}`;

export const Lobby: React.FC = () => {
    const game = useUnit($game);
    const player = useUnit($player);

    if (!game) return null;

    return (
        <>
            <h2 className="text-center">Game room {game.id}</h2>
            <div className="text-center">
                You are {player?.name} with id : {player?.id}
            </div>
            {game?.peerId && (
                <div className="text-center m-5">
                    <div>Players can join with QRCode or url</div>
                    <div className="m-2">
                        <QRCodeSVG
                            value={getJoinUrl(game.id, game.peerId)}
                            bgColor="var(--surface-ground)"
                            fgColor="var(--primary-color)"
                            title="Connect to game QRCode"
                        />
                    </div>
                    <div>
                        <a href={getJoinUrl(game.id, game.peerId)}>
                            {getJoinUrl(game.id, game.peerId)}
                        </a>
                    </div>
                </div>
            )}
            <div className="flex p-4 justify-content-center">
                <div className="w-4">
                    <div>Players</div>
                </div>
                <div>
                    <Button label="Ready" size="small" />{' '}
                    <Button label="Start Game" size="small" />
                </div>
            </div>
            <div className="flex flex-column align-items-center">
                {Object.keys(game.players).map((key) => {
                    const p = game.players[key];
                    return (
                        <div className="flex gap-5" key={p.id}>
                            <div>
                                {p.name}
                                {p.id === player?.id ? ' (you)' : ''}
                            </div>
                            <div>{p.ready ? 'Ready' : 'Not ready'}</div>
                        </div>
                    );
                })}
            </div>
        </>
    );
};
