import { describe, it, expect, beforeEach } from 'vitest';
import {
    $debugMessages,
    $debugPanelOpen,
    $debugClock,
    $debugChecksum,
    logDebugMessage,
    clearDebugMessages,
    toggleDebugPanel,
    setDebugPanelOpen,
} from '../debug/debug';

beforeEach(() => {
    clearDebugMessages();
    setDebugPanelOpen(false);
});

describe('Chorus debug — $debugMessages', () => {
    it('should append a message with all fields', () => {
        logDebugMessage({
            direction: 'in',
            message: {
                type: 'event',
                data: {
                    eventName: 'selectCard',
                    payload: { playerId: 'p1', cardIndex: 1 },
                },
                clock: 5,
                peerId: 'peer-1',
                checksum: 'abc123',
            },
        });

        const messages = $debugMessages.getState();
        expect(messages).toHaveLength(1);
        expect(messages[0]).toMatchObject({
            direction: 'in',
            type: 'event',
            eventName: 'selectCard',
            payload: { playerId: 'p1', cardIndex: 1 },
            clock: 5,
            peerId: 'peer-1',
            checksum: 'abc123',
        });
        expect(messages[0].id).toBeDefined();
        expect(messages[0].timestamp).toBeGreaterThan(0);
    });

    it('should extract action from control messages', () => {
        logDebugMessage({
            direction: 'out',
            message: {
                type: 'control',
                data: { action: 'ping' },
            },
        });

        const messages = $debugMessages.getState();
        expect(messages[0].action).toBe('ping');
        expect(messages[0].eventName).toBeUndefined();
    });

    it('should cap at 200 messages', () => {
        for (let i = 0; i < 250; i++) {
            logDebugMessage({
                direction: 'in',
                message: { type: 'event', data: { eventName: 'x' } },
            });
        }

        const messages = $debugMessages.getState();
        expect(messages).toHaveLength(200);
    });

    it('should clear all messages', () => {
        logDebugMessage({
            direction: 'in',
            message: { type: 'event', data: { eventName: 'x' } },
        });
        clearDebugMessages();
        expect($debugMessages.getState()).toHaveLength(0);
    });
});

describe('Chorus debug — $debugPanelOpen', () => {
    it('should toggle the panel', () => {
        expect($debugPanelOpen.getState()).toBe(false);
        toggleDebugPanel();
        expect($debugPanelOpen.getState()).toBe(true);
        toggleDebugPanel();
        expect($debugPanelOpen.getState()).toBe(false);
    });

    it('should set the panel open state', () => {
        setDebugPanelOpen(true);
        expect($debugPanelOpen.getState()).toBe(true);
        setDebugPanelOpen(false);
        expect($debugPanelOpen.getState()).toBe(false);
    });
});

describe('Chorus debug — $debugClock', () => {
    it('should update from message clock', () => {
        logDebugMessage({
            direction: 'in',
            message: { type: 'event', data: {}, clock: 42 },
        });
        expect($debugClock.getState()).toBe(42);
    });

    it('should keep current clock when message has no clock', () => {
        logDebugMessage({
            direction: 'in',
            message: { type: 'event', data: {}, clock: 10 },
        });
        logDebugMessage({
            direction: 'in',
            message: { type: 'event', data: {} },
        });
        expect($debugClock.getState()).toBe(10);
    });
});

describe('Chorus debug — $debugChecksum', () => {
    it('should update from message checksum', () => {
        logDebugMessage({
            direction: 'in',
            message: { type: 'event', data: {}, checksum: 'xyz' },
        });
        expect($debugChecksum.getState()).toBe('xyz');
    });

    it('should keep current checksum when message has none', () => {
        logDebugMessage({
            direction: 'in',
            message: { type: 'event', data: {}, checksum: 'old' },
        });
        logDebugMessage({
            direction: 'in',
            message: { type: 'event', data: {} },
        });
        expect($debugChecksum.getState()).toBe('old');
    });
});
