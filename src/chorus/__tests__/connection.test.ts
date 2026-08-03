import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChorusConnection } from '../core/connection';

beforeEach(() => {
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => {
            store[key] = value;
        },
        removeItem: (key: string) => {
            delete store[key];
        },
        clear: () => {
            Object.keys(store).forEach((k) => delete store[k]);
        },
    });
});

describe('ChorusConnection — Lamport clock', () => {
    it('should start at 0', () => {
        const conn = new ChorusConnection();
        expect(conn.getCurrentClock()).toBe(0);
    });

    it('should increment clock on broadcast', () => {
        const conn = new ChorusConnection();
        const peerData = conn.getPeerData();
        peerData['obj-1'] = {
            objectId: 'obj-1',
            peerId: 'me',
            peers: {},
        };
        conn.broadcastMessage({
            objectId: 'obj-1',
            message: { type: 'event', data: { eventName: 'x' } },
            getState: () => ({ id: 'obj-1' }),
        });
        expect(conn.getCurrentClock()).toBe(1);
    });

    it('should update clock to max(received, current) + 1', () => {
        const conn = new ChorusConnection();
        conn.updateClock(5);
        expect(conn.getCurrentClock()).toBe(6);
        conn.updateClock(3);
        expect(conn.getCurrentClock()).toBe(7);
    });

    it('should set clock to max value', () => {
        const conn = new ChorusConnection();
        conn.setClock(10);
        expect(conn.getCurrentClock()).toBe(10);
        conn.setClock(5);
        expect(conn.getCurrentClock()).toBe(10);
    });
});

describe('ChorusConnection — event buffer', () => {
    it('should apply buffered messages in clock order', async () => {
        const conn = new ChorusConnection();
        const applied: any[] = [];
        const processMessage = async (message: any) => {
            applied.push(message);
        };

        conn.bufferMessage(
            { type: 'event', data: { eventName: 'b' }, clock: 2, peerId: 'p1' },
            null as any
        );
        conn.bufferMessage(
            { type: 'event', data: { eventName: 'a' }, clock: 1, peerId: 'p1' },
            null as any
        );

        conn.tryFlushBuffer(processMessage as any);

        expect(applied.map((m) => m.data.eventName)).toEqual(['a', 'b']);
    });

    it('should hold messages with a gap until filled', async () => {
        const conn = new ChorusConnection();
        const applied: any[] = [];
        const processMessage = async (message: any) => {
            applied.push(message);
        };

        conn.bufferMessage(
            { type: 'event', data: { eventName: 'b' }, clock: 2, peerId: 'p1' },
            null as any
        );
        conn.tryFlushBuffer(processMessage as any);
        expect(applied).toHaveLength(0);

        conn.bufferMessage(
            { type: 'event', data: { eventName: 'a' }, clock: 1, peerId: 'p1' },
            null as any
        );
        conn.tryFlushBuffer(processMessage as any);

        expect(applied.map((m) => m.data.eventName)).toEqual(['a', 'b']);
    });
});

describe('ChorusConnection — broadcastMessage', () => {
    it('should stamp message with clock and peerId', () => {
        const conn = new ChorusConnection();
        const sent: any[] = [];
        const peerData = conn.getPeerData();
        peerData['obj-1'] = {
            objectId: 'obj-1',
            peerId: 'me',
            peers: {
                'peer-2': {
                    peerId: 'peer-2',
                    conn: { send: (m: any) => sent.push(m) } as any,
                    lastSeen: Date.now(),
                },
            },
        };

        conn.broadcastMessage({
            objectId: 'obj-1',
            message: { type: 'event', data: { eventName: 'x' } },
            getState: () => ({ id: 'obj-1' }),
        });

        expect(sent).toHaveLength(1);
        expect(sent[0]).toMatchObject({
            type: 'event',
            data: { eventName: 'x' },
            clock: 1,
            peerId: 'me',
        });
    });

    it('should compute checksum from newState', () => {
        const conn = new ChorusConnection();
        const sent: any[] = [];
        const peerData = conn.getPeerData();
        peerData['obj-1'] = {
            objectId: 'obj-1',
            peerId: 'me',
            peers: {
                'peer-2': {
                    peerId: 'peer-2',
                    conn: { send: (m: any) => sent.push(m) } as any,
                    lastSeen: Date.now(),
                },
            },
        };

        conn.broadcastMessage({
            objectId: 'obj-1',
            message: { type: 'event', data: { eventName: 'x' } },
            getState: () => ({ id: 'obj-1', value: 0 }),
            computeChecksum: (s: any) => `checksum-${s.value}`,
            newState: { id: 'obj-1', value: 42 },
        });

        expect(sent[0].checksum).toBe('checksum-42');
    });
});

describe('ChorusConnection — peer data persistence', () => {
    it('should load peer data from localStorage on construction', () => {
        localStorage.setItem(
            'dsstore-peerData',
            JSON.stringify({
                'obj-1': { objectId: 'obj-1', peerId: 'me', peers: {} },
            })
        );

        const conn = new ChorusConnection();
        const peerData = conn.getPeerData();
        expect(peerData['obj-1']).toBeDefined();
        expect(peerData['obj-1'].peerId).toBe('me');
    });
});

describe('ChorusConnection — heartbeat', () => {
    it('should expose heartbeat methods', () => {
        const conn = new ChorusConnection();
        expect(typeof conn.startHeartbeat).toBe('function');
        expect(typeof conn.stopHeartbeat).toBe('function');
        expect(typeof conn.sendHeartbeats).toBe('function');
        expect(typeof conn.checkPeerHealth).toBe('function');
    });

    it('should send ping to connected peers', () => {
        const conn = new ChorusConnection();
        const sent: any[] = [];
        const peerData = conn.getPeerData();
        peerData['obj-1'] = {
            objectId: 'obj-1',
            peerId: 'me',
            peers: {
                'peer-2': {
                    peerId: 'peer-2',
                    conn: { send: (m: any) => sent.push(m) } as any,
                    lastSeen: Date.now(),
                },
            },
        };

        conn.sendHeartbeats(() => ({ id: 'obj-1' }));

        expect(sent).toHaveLength(1);
        expect(sent[0]).toMatchObject({
            type: 'control',
            data: { action: 'ping' },
            peerId: 'me',
        });
    });

    it('should detect timed-out peers', () => {
        const conn = new ChorusConnection();
        const peerData = conn.getPeerData();
        peerData['obj-1'] = {
            objectId: 'obj-1',
            peerId: 'me',
            peers: {
                'peer-2': {
                    peerId: 'peer-2',
                    conn: { close: () => {} } as any,
                    lastSeen: Date.now() - 20000,
                },
                'peer-3': {
                    peerId: 'peer-3',
                    conn: { close: () => {} } as any,
                    lastSeen: Date.now(),
                },
            },
        };

        const disconnected = conn.checkPeerHealth(() => ({ id: 'obj-1' }));

        expect(disconnected).toContain('peer-2');
        expect(disconnected).not.toContain('peer-3');
        expect(peerData['obj-1'].peers['peer-2']).toBeUndefined();
        expect(peerData['obj-1'].peers['peer-3']).toBeDefined();
    });
});
