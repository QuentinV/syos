import { createEffect, sample, StoreWritable, EventCallable } from 'effector';
import { StateWithId, WorkflowTransition } from './types';

/**
 * Generic workflow engine.
 *
 * Registers transitions that watch a session's state. When the current status
 * (derived via `getStatus`) matches a transition's `from`, and the transition's
 * `filter` returns true, the transition's `logic` runs and the status advances
 * to `next` via `setStatus`.
 *
 * Every peer evaluates workflows independently. Since all peers share the same
 * state via Lamport clock ordering, they all reach the same conclusion.
 * Idempotent reducers prevent redundant broadcasts.
 */
export function createWorkflowEngine<State extends StateWithId>({
    $state,
    getStatus,
    setStatus,
    context,
    transitions,
}: {
    $state: StoreWritable<State>;
    getStatus: (state: State) => string | undefined;
    setStatus: EventCallable<string>;
    context?: (state: State) => any;
    transitions: WorkflowTransition<State>[];
}): void {
    transitions.forEach((w) => {
        const deriveContext =
            w.context ?? context ?? ((state: State) => ({ state }));

        sample({
            source: $state,
            filter: (state) => {
                if (!state) return false;
                if (getStatus(state) !== w.from) return false;
                const context = deriveContext(state);
                return w.filter(context);
            },
            target: createEffect((state: State) => {
                if (!state) return;
                const context = deriveContext(state);
                const res = w.logic?.(context);
                if (w.next) setStatus(w.next);
                res?.();
            }),
        });
    });
}
