import { describe, it, expect, vi, beforeEach } from 'vitest';

let createChorus: typeof import('../index').createChorus;

beforeEach(async () => {
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

    const mod = await import('../index');
    createChorus = mod.createChorus;
});

type CounterState = { id: string; count: number; status?: string } | null;

describe('Chorus — createChorus', () => {
    it('should return createSession and debug', () => {
        const chorus = createChorus({ storage: 'memory' });
        expect(typeof chorus.createSession).toBe('function');
        expect(chorus.debug).toBeDefined();
        expect(chorus.debug.$messages).toBeDefined();
        expect(chorus.debug.$panelOpen).toBeDefined();
        expect(chorus.debug.$clock).toBeDefined();
        expect(chorus.debug.$checksum).toBeDefined();
    });

    it('should accept peerHost and debug options', () => {
        const chorus = createChorus({
            storage: 'memory',
            peerHost: 'my-peerjs.example.com',
            debug: true,
        });
        expect(typeof chorus.createSession).toBe('function');
    });
});

describe('Chorus — createSession', () => {
    it('should create a session with default state', () => {
        const chorus = createChorus({ storage: 'memory' });
        const session = chorus.createSession<CounterState>({
            name: 'counter',
            defaultValue: { id: 'counter-1', count: 0 },
        });

        expect(session.$state.getState()).toEqual({
            id: 'counter-1',
            count: 0,
        });
        expect(session.$peerId.getState()).toBeNull();
        expect(typeof session.init).toBe('function');
        expect(typeof session.joinFx).toBe('function');
        expect(typeof session.useStore).toBe('function');
        expect(typeof session.usePeerId).toBe('function');
        expect(typeof session.workflows).toBe('function');
    });

    it('should register reducers via api and fire events', () => {
        const chorus = createChorus({ storage: 'memory' });
        const session = chorus.createSession<CounterState>({
            name: 'counter',
            defaultValue: { id: 'counter-1', count: 0 },
            api: {
                increment: (state: CounterState, by: number) => {
                    if (!state) return null;
                    return { ...state, count: state.count + by };
                },
            },
        });

        session.events['increment'](5);
        expect(session.$state.getState()?.count).toBe(5);

        session.events['increment'](3);
        expect(session.$state.getState()?.count).toBe(8);
    });
});

describe('Chorus — workflows (generic engine)', () => {
    it('should advance status when filter matches', () => {
        const chorus = createChorus({ storage: 'memory' });
        const session = chorus.createSession<CounterState>({
            name: 'counter',
            defaultValue: { id: 'counter-1', count: 0, status: 'idle' },
            api: {
                increment: (state: CounterState, by: number) => {
                    if (!state) return null;
                    return { ...state, count: state.count + by };
                },
            },
        });

        session.workflows({
            transitions: [
                {
                    from: 'idle',
                    filter: ({ state }) => state.count >= 3,
                    next: 'counting',
                },
            ],
        });

        session.events['increment'](1);
        session.events['increment'](1);
        expect(session.$state.getState()?.status).toBe('idle');

        session.events['increment'](1);
        expect(session.$state.getState()?.status).toBe('counting');
    });

    it('should support custom context derivation', () => {
        const chorus = createChorus({ storage: 'memory' });
        const session = chorus.createSession<CounterState>({
            name: 'counter',
            defaultValue: { id: 'counter-1', count: 0, status: 'idle' },
            api: {
                increment: (state: CounterState, by: number) => {
                    if (!state) return null;
                    return { ...state, count: state.count + by };
                },
            },
        });

        session.workflows({
            transitions: [
                {
                    from: 'idle',
                    context: (state) => ({
                        state,
                        isEven: (state?.count ?? 0) % 2 === 0,
                    }),
                    filter: ({ isEven }) => isEven,
                    next: 'even',
                },
            ],
        });

        session.events['increment'](2);
        expect(session.$state.getState()?.status).toBe('even');
    });

    it('should use default setStatus writing state.status when not provided', () => {
        const chorus = createChorus({ storage: 'memory' });
        const session = chorus.createSession<CounterState>({
            name: 'counter',
            defaultValue: { id: 'counter-1', count: 0, status: 'idle' },
            api: {
                increment: (state: CounterState, by: number) => {
                    if (!state) return null;
                    return { ...state, count: state.count + by };
                },
            },
        });

        session.workflows({
            transitions: [
                {
                    from: 'idle',
                    filter: ({ state }) => state.count >= 1,
                    next: 'counting',
                },
            ],
        });

        session.events['increment'](1);
        expect(session.$state.getState()?.status).toBe('counting');
    });

    it('should support custom getStatus/setStatus mapping', () => {
        const chorus = createChorus({ storage: 'memory' });
        const session = chorus.createSession<CounterState>({
            name: 'counter',
            defaultValue: {
                id: 'counter-1',
                count: 0,
                phase: 'idle',
            } as CounterState,
            api: {
                increment: (state: CounterState, by: number) => {
                    if (!state) return null;
                    return { ...state, count: state.count + by };
                },
            },
        });

        session.workflows({
            getStatus: (state) => (state as any)?.phase,
            setStatus: (state, status) => {
                if (!state) return null;
                if ((state as any).phase === status) return state;
                return { ...(state as any), phase: status } as CounterState;
            },
            transitions: [
                {
                    from: 'idle',
                    filter: ({ state }) => state.count >= 1,
                    next: 'counting',
                },
            ],
        });

        session.events['increment'](1);
        expect((session.$state.getState() as any)?.phase).toBe('counting');
    });
});

describe('Chorus — storage adapters', () => {
    it('should work with memory storage', () => {
        const chorus = createChorus({ storage: 'memory' });
        const session = chorus.createSession<CounterState>({
            name: 'counter',
            defaultValue: { id: 'counter-1', count: 0 },
            api: {
                increment: (state: CounterState, by: number) => {
                    if (!state) return null;
                    return { ...state, count: state.count + by };
                },
            },
        });

        session.events['increment'](1);
        expect(session.$state.getState()?.count).toBe(1);
    });

    it('should work with localStorage storage', () => {
        const chorus = createChorus({ storage: 'localstorage' });
        const session = chorus.createSession<CounterState>({
            name: 'counter',
            defaultValue: { id: 'counter-1', count: 0 },
            api: {
                increment: (state: CounterState, by: number) => {
                    if (!state) return null;
                    return { ...state, count: state.count + by };
                },
            },
        });

        session.events['increment'](1);
        expect(session.$state.getState()?.count).toBe(1);
    });
});
