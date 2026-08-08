import { createEvent, createStore } from 'effector';
import { v4 as uuid } from 'uuid';
import { DebugMessage, Message } from '../core/types';

const MAX_MESSAGES = 200;

export const $debugMessages = createStore<DebugMessage[]>([]);
export const $debugPanelOpen = createStore<boolean>(false);
export const $debugClock = createStore<number>(0);
export const $debugChecksum = createStore<string>('');

export const logDebugMessage = createEvent<{
    direction: 'in' | 'out';
    message: Message;
}>();
export const clearDebugMessages = createEvent<void>();
export const toggleDebugPanel = createEvent<void>();
export const setDebugPanelOpen = createEvent<boolean>();

$debugMessages.on(logDebugMessage, (messages, { direction, message }) => {
    const entry: DebugMessage = {
        id: uuid(),
        direction,
        timestamp: Date.now(),
        type: message.type,
        clock: message.clock,
        peerId: message.peerId,
        checksum: message.checksum,
        eventName: message.data?.eventName,
        action: message.data?.action,
        payload: message.data?.payload,
    };

    const next = [...messages, entry];
    return next.length > MAX_MESSAGES
        ? next.slice(next.length - MAX_MESSAGES)
        : next;
});

$debugMessages.on(clearDebugMessages, () => []);

$debugPanelOpen.on(toggleDebugPanel, (open) => !open);
$debugPanelOpen.on(setDebugPanelOpen, (_, open) => open);

$debugClock.on(logDebugMessage, (current, { message }) =>
    message.clock !== undefined ? message.clock : current
);

$debugChecksum.on(logDebugMessage, (current, { message }) =>
    message.checksum !== undefined ? message.checksum : current
);

export const debug = {
    $messages: $debugMessages,
    $panelOpen: $debugPanelOpen,
    $clock: $debugClock,
    $checksum: $debugChecksum,
    log: logDebugMessage,
    clear: clearDebugMessages,
    togglePanel: toggleDebugPanel,
    setPanelOpen: setDebugPanelOpen,
};
