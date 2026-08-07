import { createContext, useContext } from 'react';

export interface ChorusSessionContextValue {
    sessionId: string;
    peerId: string;
    getJoinUrl: (sessionId: string, peerId: string) => string;
    checksum?: (state: any) => string;
}

export const ChorusSessionContext =
    createContext<ChorusSessionContextValue | null>(null);

export const useChorusSession = (): ChorusSessionContextValue => {
    const ctx = useContext(ChorusSessionContext);
    if (!ctx) {
        throw new Error(
            'useChorusSession must be used within a session Provider. ' +
                'Wrap your component with the Provider returned by createSession().'
        );
    }
    return ctx;
};
