import React, { useEffect, useRef } from 'react';

export interface SessionPageProps {
    /** Session id. When not provided, the init effect is skipped. */
    id?: string;
    /** Whether to auto-init the session. Defaults to true. */
    init?: boolean;
    /** Host-side init callback (e.g. the session `init` event). */
    initSession: (id: string) => void;
    children?: React.ReactNode;
}

export const SessionPage: React.FC<SessionPageProps> = ({
    id,
    init = true,
    initSession,
    children,
}) => {
    const initSessionRef = useRef(initSession);
    initSessionRef.current = initSession;

    useEffect(() => {
        if (init && id) {
            initSessionRef.current(id);
        }
    }, [id, init]);

    return <>{children}</>;
};
