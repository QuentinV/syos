import { debug as chorusDebug } from '../chorus';

export interface DebugMessage {
    id: string;
    direction: 'in' | 'out';
    timestamp: number;
    type: string;
    eventName?: string;
    action?: string;
    clock?: number;
    peerId?: string;
    checksum?: string;
    payload?: any;
}

export const $debugMessages = chorusDebug.$messages;
export const $debugPanelOpen = chorusDebug.$panelOpen;
export const $debugClock = chorusDebug.$clock;
export const $debugChecksum = chorusDebug.$checksum;

export const logDebugMessage = chorusDebug.log;
export const clearDebugMessages = chorusDebug.clear;
export const toggleDebugPanel = chorusDebug.togglePanel;
export const setDebugPanelOpen = chorusDebug.setPanelOpen;
