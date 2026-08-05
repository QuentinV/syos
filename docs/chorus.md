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

| Property                 | Type                            | Description                                                                     |
| ------------------------ | ------------------------------- | ------------------------------------------------------------------------------- |
| `store`                  | `ChorusSession`                 | Register reducers (`.on()` / `.localOn()`)                                      |
| `init`                   | `Event<string>`                 | Initialize as host for a session ID                                             |
| `$state`                 | `Store<State>`                  | Effector store (read with `useUnit`)                                            |
| `$peerId`                | `Store<string \| null>`         | This peer's ID                                                                  |
| `useStore()`             | `() => State`                   | React hook for state                                                            |
| `usePeerId()`            | `() => string \| null`          | React hook for peer ID                                                          |
| `joinFx`                 | `Effect`                        | Join an existing session via P2P link                                           |
| `events`                 | `{ [name]: Event }`             | Mapped effector events from `api`                                               |
| `setStatus`              | `Event<string>`                 | Advance session status (used by workflows)                                      |
| `workflows(transitions)` | `(t) => void`                   | Register workflow transitions                                                   |
| `startHeartbeat()`       | `() => void`                    | Start heartbeat monitoring                                                      |
| `stopHeartbeat()`        | `() => void`                    | Stop heartbeat monitoring                                                       |
| `checkPeerHealth()`      | `() => string[]`                | Check for disconnected peers                                                    |
| `$id`                    | `Store<string \| null>`         | Derived store: the active session id (only changes when the session id changes) |
| `Provider`               | `React.FC`                      | React context provider for Chorus components                                    |
| `getJoinUrl`             | `(sessionId, peerId) => string` | Build the join URL for this session                                             |

## Session Context

Chorus components like `QRCode` and `SessionLobby` need to know the active session (`sessionId`, `peerId`) and how to build a join URL. Instead of prop drilling, the session provides a React context via its `Provider` component.

### Configure getJoinUrl

Provide a `getJoinUrl` function in the session config to customize how join URLs are built. It defaults to `${origin}/join/${sessionId}/${peerId}`.

```typescript
const session = chorus.createSession<MyState>({
    name: 'my-session',
    defaultValue: null,
    getJoinUrl: (sessionId, peerId) =>
        `${document.location.origin}/syos#/game/${sessionId}/join/${peerId}`,
});
```

### Mount the Provider

```tsx
import { SessionLobby } from 'chorus';

const MyLobby = ({ participants, ... }) => (
    <session.Provider>
        <SessionLobby participants={participants} ... />
    </session.Provider>
);
```

The `Provider` reads from the `$id` and `$peerId` stores (not the full `$state`), so it only re-renders when the session id or peer id changes — not on every state mutation, keeping the component tree stable during gameplay.

### useChorusSession

Any component can read the session context directly:

```tsx
import { useChorusSession } from 'chorus';

const MyComponent = () => {
    const { sessionId, peerId, getJoinUrl } = useChorusSession();
    const url = getJoinUrl(sessionId, peerId);
    return <a href={url}>{url}</a>;
};
```

`useChorusSession` throws if used outside a session `Provider`.

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
    getStatus: (state) => state.status, // read status
    setStatus: (state, status) => {
        if (!state) return null;
        if (state.status === status) return state; // idempotent
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

## Components

Chorus ships with a set of generic, UI-framework-agnostic React components for common P2P session patterns.

### QRCode

Renders a QR code for the active session's join URL. Reads `sessionId`, `peerId`, and `getJoinUrl` from the session context (see `session.Provider` below). Clicking the QR code always copies the join URL to the clipboard.

```tsx
import { QRCode } from 'chorus';

<QRCode bgColor="#1a1a1a" fgColor="#f59e0b" title="Join session QRCode" />;
```

| Prop         | Type     | Description          |
| ------------ | -------- | -------------------- |
| `bgColor?`   | `string` | Background color     |
| `fgColor?`   | `string` | Foreground color     |
| `title?`     | `string` | Accessible title     |
| `className?` | `string` | Additional CSS class |

### Countdown

A simple countdown timer with two visual styles.

```tsx
import { Countdown } from 'chorus';

<Countdown limit={60} onComplete={() => handleTimeout()} style="knob" />;
```

| Prop         | Type              | Description                         |
| ------------ | ----------------- | ----------------------------------- |
| `limit`      | `number`          | Countdown duration in seconds       |
| `onComplete` | `() => void`      | Called when the countdown reaches 0 |
| `style?`     | `'knob' \| 'bar'` | Visual style (default: `'knob'`)    |

### DebugPanel

A floating debug sidebar that displays P2P messages, Lamport clock, checksums, and the current session state. Reads directly from the Chorus debug stores.

```tsx
import { DebugPanel } from 'chorus';

<DebugPanel
    state={myState}
    peerId={peerId}
    liveChecksum={computeChecksum(myState)}
/>;
```

| Prop            | Type             | Description                           |
| --------------- | ---------------- | ------------------------------------- |
| `state?`        | `any`            | Current session state (shown as JSON) |
| `peerId?`       | `string \| null` | This peer's ID                        |
| `liveChecksum?` | `string`         | Live checksum of the current state    |

### SessionLobby

A generic session lobby showing connected participants, ready status, and a join QR code. Reads `sessionId` and `peerId` from the session context (see `session.Provider` below).

```tsx
import { SessionLobby } from 'chorus';

<SessionLobby
    participants={[
        { id: 'p1', name: 'Alice', ready: true },
        { id: 'p2', name: 'Bob', ready: false },
    ]}
    currentParticipantId="p1"
    onToggleReady={(id) => toggleReady(id)}
    onStart={() => startSession()}
    canStart={allParticipantsReady}
/>;
```

| Prop                    | Type                              | Description                                     |
| ----------------------- | --------------------------------- | ----------------------------------------------- |
| `participants`          | `SessionLobbyParticipant[]`       | List of participants `{ id, name, ready }`      |
| `currentParticipantId?` | `string`                          | The local participant's ID                      |
| `onToggleReady`         | `(participantId: string) => void` | Called when the local participant toggles ready |
| `onStart`               | `() => void`                      | Called when the host starts the session         |
| `canStart`              | `boolean`                         | Whether the start button is enabled             |

### JoinSession

A generic "connecting" screen shown while a participant joins a session via a P2P link.

```tsx
import { JoinSession } from 'chorus';

<JoinSession
    sessionId="session-123"
    peerId="peer-abc"
    participantName="Alice"
/>;
```

| Prop               | Type     | Description                  |
| ------------------ | -------- | ---------------------------- |
| `sessionId`        | `string` | The session ID being joined  |
| `peerId`           | `string` | The host peer ID             |
| `participantName?` | `string` | The local participant's name |

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
