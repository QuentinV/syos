import { createEvent, EventCallable, StoreWritable } from 'effector';
import { ChorusConnection } from './connection';
import { Reducers, StateWithId } from './types';

// -- ChorusSession: effector store wrapper with P2P sync
export class ChorusSession<State extends StateWithId> {
    private $store;
    private units: { [key: string]: EventCallable<any> };
    private localUnits: { [key: string]: EventCallable<any> };
    private getState: () => State;
    private computeChecksum?: (state: State) => string;
    private connection: ChorusConnection;

    constructor(
        $store: StoreWritable<State>,
        getState: () => State,
        connection: ChorusConnection,
        api?: Reducers<State>,
        computeChecksum?: (state: State) => string
    ) {
        this.$store = $store;
        this.getState = getState;
        this.connection = connection;
        this.computeChecksum = computeChecksum;
        this.units = {};
        this.localUnits = {};
        Object.keys(api ?? {}).forEach((event) => {
            if (!api?.[event]) return;
            this.on(event, createEvent(), api[event]);
        });

        this.on('setState', createEvent(), (_, state) => state);
    }

    getUnits() {
        return this.units;
    }

    getLocalUnits() {
        return this.localUnits;
    }

    /**
     * Local reducer binding doesn't trigger sync with other peers
     */
    localOn<E>(
        trigger: EventCallable<E>,
        reducer: (state: State, payload: E) => State | void
    ): this {
        this.$store.on(trigger, reducer);
        return this;
    }

    on<E>(
        name: string,
        trigger: EventCallable<E>,
        reducer: (state: State, payload: E) => State | void
    ): this {
        this.units[name] = trigger;

        const localEvent = createEvent<E>();
        this.localUnits[name] = localEvent;

        this.$store
            .on(trigger, (state, payload) => {
                const id = state?.id ?? (payload as any)?.id;
                if (!id) return state;
                const r = reducer(state, payload);
                // Skip broadcast if reducer returned the same state reference
                if (r && r !== state) {
                    // Compute checksum from the new state (post-reducer, pre-cascade)
                    // by passing r as newState to broadcastMessage. The broadcast is synchronous
                    // (inside the reducer), so the checksum is computed before any workflow
                    // cascade can modify the shared state references.
                    this.connection.broadcastMessage({
                        objectId: id,
                        message: {
                            type: 'event',
                            data: {
                                eventName: name,
                                payload,
                            },
                        },
                        getState: this.getState,
                        computeChecksum: this.computeChecksum,
                        newState: r,
                    });
                }
                return r;
            })
            .on(localEvent, (state, payload) => {
                const id = state?.id ?? (payload as any)?.id;
                if (!id) return state;
                return reducer(state, payload);
            });

        return this;
    }
}
