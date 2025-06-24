import { Button } from 'primereact/button';
import React from 'react';
import { newTurnFx } from '../../../state/init';

export const TurnEnded: React.FC = () => {
    return (
        <div>
            <div>Turn has ended, ready for a new turn ?</div>
            <div className="ml-5 mt-3">
                <Button size="small" onClick={() => newTurnFx()}>
                    Let's go
                </Button>
            </div>
        </div>
    );
};
