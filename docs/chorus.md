# Chorus — Decentralized P2P State Library

> A serverless, peer-to-peer state synchronization library built on effector + PeerJS.

## Overview

Chorus lets you create synchronized state containers ("sessions") that automatically sync across all connected peers via WebRTC. No central server required — just a PeerJS signaling server (default: `0.peerjs.com`).

## Installation

```bash
yarn add chorus
```

## Quick Start

```typescript
import { createChorus } from 'chorus';

// Create a Chorus instance
const chorus = createChorus({
    peerHost: '0.peerjs.com', // PeerJS server host
    debug: true,              // enable debug stores
    storage: 'indexeddb',     // 'indexeddb' | 'memory' | 'localstorage'
});

// Create a session (one synchronized state container)
const session = chorus.createSession<CounterState>({
    name: 'counter',          // unique session name (storage key)
    defaultValue: { id: 'counter-1', count: 0 },
    api: {
        increment: (state, by) => ({ ...state, count: state.count + by }),
    },
    checksum: (state) => JSON.stringify(state), // optional divergence detection
});

// Fire events — automatically broadcast to all peers
session.events['increment'](5);

// Read state
const state = session.$state.getState();

// React hooks
const MyComponent = () => {
    const state = session.useStore();
    const peerId = session.usePeerId();
    return <div>{state?.count}</div>;
};
```

## Session API

| Property                 | Type                    | Description                                |
| ------------------------ | ----------------------- | ------------------------------------------ |
| `store`                  | `ChorusSession`         | Register reducers (`.on()` / `.localOn()`) |
| `init`                   | `Event<string>`         | Initialize as host for a session ID        |
| `$state`                 | `Store<State>`          | Effector store (read with `useUnit`)       |
| `$peerId`                | `Store<string \| null>` | This peer's ID                             |
| `useStore()`             | `() => State`           | React hook for state                       |
| `usePeerId()`            | `() => string \| null`  | React hook for peer ID                     |
| `joinFx`                 | `Effect`                | Join an existing session via P2P link      |
| `events`                 | `{ [name]: Event }`     | Mapped effector events from `api`          |
| `setStatus`              | `Event<string>`         | Advance session status (used by workflows) |
| `workflows(transitions)` | `(t) => void`           | Register workflow transitions              |
| `startHeartbeat()`       | `() => void`            | Start heartbeat monitoring                 |
| `stopHeartbeat()`        | `() => void`            | Stop heartbeat monitoring                  |
| `checkPeerHealth()`      | `() => string[]`        | Check for disconnected peers               |

## Registering Reducers

```typescript
// P2P-synced reducer (broadcasts to all peers)
session.store.on('myEvent', myEvent, (state, payload) => {
    return { ...state, modified: true };
});

// Local-only reducer (no broadcast)
session.store.localOn(myLocalEvent, (state, payload) => {
    return { ...state, localOnly: true };
});
```

## Workflows

Workflows are a generic state machine for advancing session status. Each transition watches the session's state and fires when the current status matches `from` and `filter` returns true.

```typescript
session.workflows([
    {
        from: 'idle',
        filter: ({ state }) => state.count >= 3,
        next: 'counting',
    },
    {
        from: 'counting',
        context: (state) => ({ state, isEven: state.count % 2 === 0 }),
        filter: ({ isEven }) => isEven,
        logic: ({ state }) => {
            console.log('Count is even!', state.count);
        },
        next: 'done',
    },
]);
```

### Workflow Transition

| Property   | Type                               | Description                                                                     |
| ---------- | ---------------------------------- | ------------------------------------------------------------------------------- |
| `from`     | `string`                           | The status this transition starts from                                          |
| `context?` | `(state) => any`                   | Derive context passed to `filter`/`logic`. Defaults to `(state) => ({ state })` |
| `filter`   | `(context) => boolean`             | When true, the transition fires                                                 |
| `logic?`   | `(context) => void \| (() => any)` | Side-effect logic. May return a function to call after advancing                |
| `next?`    | `string`                           | The status to advance to                                                        |

### Wiring setStatus

The workflow engine calls `session.setStatus` to advance status. Provide a `setStatus` function in the session config and Chorus auto-registers it as a P2P-synced reducer:

```typescript
const session = chorus.createSession<MyState>({
    name: 'my-session',
    defaultValue: null,
    getStatus: (state) => state.status,                  // read status
    setStatus: (state, status) => {
        if (!state) return null;
        if (state.status === status) return state;       // idempotent
        return { ...state, status };
    },
});
```

## Debugging

```typescript
const chorus = createChorus({ debug: true });

// Access debug stores
chorus.debug.$messages; // Store<DebugMessage[]>
chorus.debug.$panelOpen; // Store<boolean>
chorus.debug.$clock; // Store<number>
chorus.debug.$checksum; // Store<string>

// Actions
chorus.debug.clear(); // clear messages
chorus.debug.togglePanel(); // toggle panel
chorus.debug.setPanelOpen(true);
```

## Storage Adapters

| Adapter        | Description                                                       |
| -------------- | ----------------------------------------------------------------- |
| `indexeddb`    | Default. Persists state to IndexedDB with sessionStorage fallback |
| `memory`       | In-memory Map. Useful for tests and non-browser environments      |
| `localstorage` | Persists state to localStorage                                    |

## Example: Collaborative Counter

```typescript
import { createChorus } from 'chorus';

const chorus = createChorus({ storage: 'memory' });

const session = chorus.createSession<{ id: string; count: number } | null>({
    name: 'counter',
    defaultValue: { id: 'counter-1', count: 0 },
    api: {
        increment: (state, by: number) =>
            state ? { ...state, count: state.count + by } : null,
        reset: () => ({ id: 'counter-1', count: 0 }),
    },
});

// Host initializes
session.init('counter-1');

// Join via P2P link
// session.joinFx({ objectId: 'counter-1', peerId: 'host-peer-id' });

// Any peer can increment — all peers stay in sync
session.events['increment'](1);
```

## Architecture

```
src/chorus/
├── index.ts              ← public entry
├── types.ts              ← shared types
├── core/
│   ├── createChorus.ts   ← main factory
│   ├── connection.ts     ← ChorusConnection (PeerJS transport)
│   ├── session.ts        ← ChorusSession (effector store + P2P reducers)
│   └── storage.ts        ← storage adapters
├── eventLog.ts           ← append-only event log
├── workflow.ts           ← generic workflow engine
├── debug.ts              ← debug stores
└── react.ts              ← React hooks
```

## How It Works

1. **Lamport clock ordering**: Every message is stamped with a monotonic clock. Incoming messages are buffered and reordered by `(clock, peerId)` before being applied, ensuring deterministic ordering across all peers.

2. **P2P sync**: When a reducer fires, it updates local state and broadcasts the event to all connected peers. Peers apply the event through their own reducer, keeping all states in sync.

3. **Reconnection**: An append-only event log in IndexedDB enables reconnecting peers to replay missed events and catch up.

4. **Heartbeat**: Peers send periodic pings. Peers that don't respond within 15 seconds are considered disconnected and removed.

5. **Checksums**: Optional `checksum` function detects state divergence between peers.

## Limitations

- Event log is best-effort (IndexedDB writes may fail silently)
- No CRDT-level conflict resolution — relies on per-slot writes to avoid conflicts
- Requires a PeerJS signaling server (default: `0.peerjs.com`)
