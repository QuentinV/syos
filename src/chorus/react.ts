import { useUnit } from 'effector-react';
import { StoreWritable } from 'effector';

export function createHooks<State>({
    $state,
    $peerId,
}: {
    $state: StoreWritable<State>;
    $peerId: StoreWritable<string | null>;
}) {
    return {
        useStore: () => useUnit($state),
        usePeerId: () => useUnit($peerId),
    };
}
