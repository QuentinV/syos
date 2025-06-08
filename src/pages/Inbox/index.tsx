import React from 'react';
import { Button } from 'primereact/button';
import { useNavigate } from 'react-router-dom';
import { newGameFx } from '../../state/init';

export const InboxPage = () => {
    const navigate = useNavigate();
    return (
        <>
            <div className="flex align-items-center gap-4 justify-content-center w-full h-full flex-wrap">
                <div className="flex gap-4 align-items-center">
                    <div>
                        <img src="/logo_transparent.png" alt="Logo" />
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
                                onClick={async () => {
                                    const id = await newGameFx();
                                    navigate(`/game/${id}`);
                                }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};
