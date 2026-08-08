import {
    createEffect,
    createEvent,
    createStore,
    EventCallable,
    sample,
    StoreWritable,
} from 'effector';
import { v4 as uuid } from 'uuid';
import { Participant } from './types';

export interface ParticipantStore {
    $participant: StoreWritable<Participant | null>;
    setParticipantName: EventCallable<string>;
}

/**
 * Create a generic local participant store.
 *
 * Persists the current participant (id, name) in localStorage under the
 * given storage key. This is the "active participant" of the session.
 */
export function createParticipantStore(
    storageKey = 'participant'
): ParticipantStore {
    const $participant = createStore<Participant | null>(null);
    const setParticipantName = createEvent<string>();

    const reloadFromStorageFx = createEffect(() => {
        const str = localStorage.getItem(storageKey);
        return str
            ? JSON.parse(str)
            : {
                  id: uuid(),
                  name: 'Player ' + Math.floor(Math.random() * 1000),
                  ready: false,
              };
    });

    $participant
        .on(setParticipantName, (participant, name) =>
            participant ? { ...participant, name } : null
        )
        .on(reloadFromStorageFx.doneData, (_, state) => state);

    sample({
        source: $participant,
        filter: (participant) => !!participant,
        target: createEffect((participant: Participant) => {
            localStorage.setItem(storageKey, JSON.stringify(participant));
        }),
    });

    reloadFromStorageFx();

    return {
        $participant,
        setParticipantName,
    };
}
