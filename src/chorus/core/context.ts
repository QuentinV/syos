import { createContext, useContext } from 'react';
import { EventCallable, Store } from 'effector';
import { useUnit } from 'effector-react';
import { JoinFxType } from './types';

export interface ChorusSessionContextValue {
    sessionId: string;
    getJoinUrl: (sessionId: string, peerId: string) => string;
    joinFx: JoinFxType;
    checksum?: (state: any) => string;
    // Stable references — identity never changes, so the context value stays stable.
    // Consumers read live values via useUnit(ctx.$store) / useUnit(ctx.$id) / useUnit(ctx.$peerId).
    $store: Store<any>; // Store<State> (read-only view)
    $id: Store<string | null>;
    $peerId: Store<string | null>;
    events: { [key: string]: EventCallable<any> }; // matches ChorusSession.getUnits()
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

/**
 * Read the session state store from the session context.
 * Must be used within a session Provider.
 */
export const useSessionState = <State = any>(): State => {
    const { $store } = useChorusSession();
    return useUnit($store);
};

/**
 * Read the active session id from the session context.
 * Must be used within a session Provider.
 */
export const useSessionId = (): string | null => {
    const { $id } = useChorusSession();
    return useUnit($id);
};

/**
 * Read this peer's id from the session context.
 * Must be used within a session Provider.
 */
export const useSessionPeerId = (): string | null => {
    const { $peerId } = useChorusSession();
    return useUnit($peerId);
};
