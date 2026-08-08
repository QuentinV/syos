import { describe, it, expect, vi } from 'vitest';
import { createStore, createEvent } from 'effector';
import { createWorkflowEngine } from '../core/workflow';

type CounterState = { id: string; count: number; status: string } | null;

function createSession() {
    const $state = createStore<CounterState>({
        id: 'counter',
        count: 0,
        status: 'idle',
    });
    const setStatus = createEvent<string>();
    const updateState = createEvent<CounterState>();
    $state.on(updateState, (_, state) => state);
    $state.on(setStatus, (state, status) => {
        if (!state) return state;
        if (state.status === status) return state;
        return { ...state, status };
    });
    const getStatus = (state: CounterState) => state?.status;

    return { $state, setStatus, getStatus, updateState };
}

describe('Chorus workflow — createWorkflowEngine', () => {
    it('should advance status when filter matches', async () => {
        const { $state, setStatus, getStatus, updateState } = createSession();

        createWorkflowEngine({
            $state,
            getStatus,
            setStatus,
            transitions: [
                {
                    from: 'idle',
                    filter: ({ state }) => state.count >= 3,
                    next: 'counting',
                },
            ],
        });

        updateState({ id: 'counter', count: 3, status: 'idle' });
        await vi.waitFor(() => {
            expect($state.getState()?.status).toBe('counting');
        });
    });

    it('should NOT advance when filter returns false', async () => {
        const { $state, setStatus, getStatus, updateState } = createSession();

        createWorkflowEngine({
            $state,
            getStatus,
            setStatus,
            transitions: [
                {
                    from: 'idle',
                    filter: ({ state }) => state.count >= 3,
                    next: 'counting',
                },
            ],
        });

        updateState({ id: 'counter', count: 2, status: 'idle' });
        // Give the engine a chance to (incorrectly) advance — should not
        await new Promise((r) => setTimeout(r, 10));
        expect($state.getState()?.status).toBe('idle');
    });

    it('should NOT advance when from does not match current status', async () => {
        const { $state, setStatus, getStatus, updateState } = createSession();

        createWorkflowEngine({
            $state,
            getStatus,
            setStatus,
            transitions: [
                {
                    from: 'running',
                    filter: () => true,
                    next: 'done',
                },
            ],
        });

        updateState({ id: 'counter', count: 0, status: 'idle' });
        await new Promise((r) => setTimeout(r, 10));
        expect($state.getState()?.status).toBe('idle');
    });

    it('should run logic side-effect when filter matches', async () => {
        const { $state, setStatus, getStatus, updateState } = createSession();
        let logicRan = false;

        createWorkflowEngine({
            $state,
            getStatus,
            setStatus,
            transitions: [
                {
                    from: 'idle',
                    filter: ({ state }) => state.count >= 1,
                    logic: () => {
                        logicRan = true;
                    },
                    next: 'counting',
                },
            ],
        });

        updateState({ id: 'counter', count: 1, status: 'idle' });
        await vi.waitFor(() => {
            expect(logicRan).toBe(true);
        });
    });

    it('should use config-level context when transition has none', async () => {
        const { $state, setStatus, getStatus, updateState } = createSession();
        let receivedContext: any = null;

        createWorkflowEngine({
            $state,
            getStatus,
            setStatus,
            context: (state) => ({
                state,
                isEven: (state?.count ?? 0) % 2 === 0,
            }),
            transitions: [
                {
                    from: 'idle',
                    filter: ({ isEven }) => isEven,
                    logic: (ctx) => {
                        receivedContext = ctx;
                    },
                    next: 'even',
                },
            ],
        });

        updateState({ id: 'counter', count: 2, status: 'idle' });
        await vi.waitFor(() => {
            expect($state.getState()?.status).toBe('even');
        });
        expect(receivedContext.isEven).toBe(true);
        expect(receivedContext.state.count).toBe(2);
    });

    it('should let transition context override config-level context', async () => {
        const { $state, setStatus, getStatus, updateState } = createSession();
        let receivedContext: any = null;

        createWorkflowEngine({
            $state,
            getStatus,
            setStatus,
            context: (state) => ({
                state,
                isEven: (state?.count ?? 0) % 2 === 0,
                source: 'config',
            }),
            transitions: [
                {
                    from: 'idle',
                    context: (state) => ({
                        state,
                        isEven: (state?.count ?? 0) % 2 === 0,
                        source: 'transition',
                    }),
                    filter: ({ source }) => source === 'transition',
                    logic: (ctx) => {
                        receivedContext = ctx;
                    },
                    next: 'odd',
                },
            ],
        });

        updateState({ id: 'counter', count: 2, status: 'idle' });
        await vi.waitFor(() => {
            expect($state.getState()?.status).toBe('odd');
        });
        expect(receivedContext.source).toBe('transition');
        expect(receivedContext.isEven).toBe(true);
        expect(receivedContext.state.count).toBe(2);
    });

    it('should support custom context derivation', async () => {
        const { $state, setStatus, getStatus, updateState } = createSession();
        let receivedContext: any = null;

        createWorkflowEngine({
            $state,
            getStatus,
            setStatus,
            transitions: [
                {
                    from: 'idle',
                    context: (state) => ({
                        state,
                        isEven: (state?.count ?? 0) % 2 === 0,
                    }),
                    filter: ({ isEven }) => isEven,
                    logic: (ctx) => {
                        receivedContext = ctx;
                    },
                    next: 'even',
                },
            ],
        });

        updateState({ id: 'counter', count: 2, status: 'idle' });
        await vi.waitFor(() => {
            expect($state.getState()?.status).toBe('even');
        });
        expect(receivedContext.isEven).toBe(true);
        expect(receivedContext.state.count).toBe(2);
    });

    it('should call logic-returned function after advancing', async () => {
        const { $state, setStatus, getStatus, updateState } = createSession();
        let postAdvanceRan = false;

        createWorkflowEngine({
            $state,
            getStatus,
            setStatus,
            transitions: [
                {
                    from: 'idle',
                    filter: () => true,
                    logic: () => {
                        return () => {
                            postAdvanceRan = true;
                        };
                    },
                    next: 'done',
                },
            ],
        });

        updateState({ id: 'counter', count: 0, status: 'idle' });
        await vi.waitFor(() => {
            expect($state.getState()?.status).toBe('done');
        });
        await vi.waitFor(() => {
            expect(postAdvanceRan).toBe(true);
        });
    });
});
