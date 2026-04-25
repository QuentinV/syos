import React, { useEffect } from 'react';
import { useUnit } from 'effector-react';
import { Button } from 'primereact/button';
import { useNavigate } from 'react-router-dom';
import { $navigateToGame, newGameFx } from '../../state/init';

export const InboxPage = () => {
    const navigate = useNavigate();
    const gameId = useUnit($navigateToGame);

    useEffect(() => {
        if (!gameId) return;
        navigate(`/game/${gameId}`);
    }, [gameId, navigate]);

    return (
        <>
            <div className="flex align-items-center gap-4 justify-content-center w-full h-full flex-wrap">
                <div className="flex gap-4 align-items-center">
                    <div>
                        <img src="/syos/logo_transparent.png" alt="Logo" />
                    </div>
                    <div className="flex flex-column align-items-center gap-2">
                        <h1 className="text-primary">Shape your own stories</h1>
                        <div>
                            <Button
                                className="p-button-outlined"
                                icon="pi pi-plus-circle"
                                label="New Game"
                                size="small"
                                severity="secondary"
                                onClick={() => newGameFx()}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};
