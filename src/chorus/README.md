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

The context value exposes the session's **stable references** — the effector stores (`$store`, `$id`, `$peerId`) and the mapped events. Because effector stores and events are stable object references (their identity never changes, only their values), the context value itself stays stable: consumers read live values with `useUnit(ctx.$store)` and only re-render when the specific store they subscribe to changes.

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

const MyLobby = () => (
    <session.Provider>
        <SessionLobby />
    </session.Provider>
);
```

The `Provider` reads from the `$id` and `$peerId` stores (not the full `$state`), so it only re-renders when the session id or peer id changes — not on every state mutation, keeping the component tree stable during gameplay.

### Context value

| Property     | Type                               | Description                                               |
| ------------ | ---------------------------------- | --------------------------------------------------------- |
| `sessionId`  | `string`                           | The active session id (value of `$id`)                    |
| `getJoinUrl` | `(sessionId, peerId) => string`    | Build the join URL for this session                       |
| `checksum?`  | `(state) => string`                | Optional checksum function for divergence detection       |
| `$store`     | `Store<any>`                       | The session state store — read with `useUnit(ctx.$store)` |
| `$id`        | `Store<string \| null>`            | The active session id store                               |
| `$peerId`    | `Store<string \| null>`            | This peer's ID store                                      |
| `events`     | `{ [key: string]: EventCallable }` | Mapped effector events from `api`                         |

### useChorusSession

Any component can read the session context directly:

```tsx
import { useUnit } from 'effector-react';
import { useChorusSession } from 'chorus';

const MyComponent = () => {
    const { sessionId, getJoinUrl, $peerId } = useChorusSession();
    const peerId = useUnit($peerId);
    const url = getJoinUrl(sessionId, peerId);
    return <a href={url}>{url}</a>;
};
```

`useChorusSession` throws if used outside a session `Provider`.

### Context hooks

Chorus provides a set of React hooks that read directly from the session context, removing the need to manually call `useChorusSession()` + `useUnit()`:

```tsx
import { useSessionState, useSessionId, useSessionPeerId } from 'chorus';

const MyComponent = () => {
    const state = useSessionState<MyState>();
    const sessionId = useSessionId();
    const peerId = useSessionPeerId();
    return (
        <div>
            {sessionId} / {peerId} / {JSON.stringify(state)}
        </div>
    );
};
```

| Hook                 | Returns          | Description                   |
| -------------------- | ---------------- | ----------------------------- |
| `useSessionState<T>` | `T`              | The session state store value |
| `useSessionId`       | `string \| null` | The active session id         |
| `useSessionPeerId`   | `string \| null` | This peer's id                |

All context hooks throw if used outside a session `Provider`.

### Turn hooks

For turn-based sessions, `createTurnSession` returns **typed hooks** — stable closures created once in the factory, so they capture `TStatus`/`TTurnData` and need no type parameters at call sites. They must be used within a turn session `Provider` (the `Provider` returned by `createTurnSession`, which composes the session context with a dedicated turn context).

```tsx
const session = chorus.createTurnSession<MyStatus, MyTurnData>({ ... });

// Typed hooks returned by the session
const MyComponent = ({ participantId }) => {
    const turn = session.useTurn();
    const previousTurn = session.usePreviousTurn();
    const status = session.useTurnStatus();
    const myTurn = session.useParticipantTurn(participantId);
    const allTurns = session.useTurnParticipants();
    const hostTurn = session.useTurnParticipantByPredicate(
        (turn) => turn.isHost
    );
    return <div>{status}</div>;
};
```

Because the hooks are provided via a dedicated turn context, any component inside the turn session's `Provider` can also read them with `useChorusTurn`:

```tsx
import { useChorusTurn } from 'chorus';

const MyComponent = () => {
    const { useTurn, useParticipantTurn } = useChorusTurn<
        MyStatus,
        MyTurnData
    >();
    const turn = useTurn();
    return <div>{turn?.status}</div>;
};
```

> **Note:** `useChorusTurn` throws if used outside a turn session `Provider`. Plain `createSession` providers do not expose turn hooks — they live in the turn context only.

| Hook                                | Returns                   | Description                                                                           |
| ----------------------------------- | ------------------------- | ------------------------------------------------------------------------------------- |
| `useTurn()`                         | `Turn<T, D> \| undefined` | The current (last) turn                                                               |
| `usePreviousTurn()`                 | `Turn<T, D> \| undefined` | The previous (second-to-last) turn                                                    |
| `useTurnStatus()`                   | `T \| null`               | The current turn's status                                                             |
| `useParticipantTurn(participantId)` | `D \| undefined`          | A participant's turn data in the current turn                                         |
| `useTurnParticipants()`             | `{ [id]: D }`             | All participants' turn data in the current turn                                       |
| `useTurnParticipantByPredicate(fn)` | `D \| undefined`          | Find a participant's turn data by predicate                                           |
| `useLocalParticipantTurn()`         | `D \| undefined`          | The local participant's turn data (requires `participantStore` in the session config) |

`useLocalParticipantTurn` reads the local participant from the `participantStore` passed in the session config and returns their turn data:

```tsx
const session = chorus.createTurnSession<MyStatus, MyTurnData>({
    name: 'my-session',
    defaultValue: null,
    participantStore: createParticipantStore('player'),
    ...
});

const MyComponent = () => {
    const myTurn = session.useLocalParticipantTurn();
    return <div>{myTurn?.score}</div>;
};
```

> **Note:** The standalone generic hooks (`useTurn<T, D>()`, etc.) are also exported from `chorus` for advanced use cases, but the session-returned typed hooks are the recommended DX.

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

A generic session lobby showing connected participants, ready status, and a join QR code. Takes **no props** — it reads everything from the turn-session context (see `session.Provider` below):

- **Session state** (via `useSessionState`): participants list, ready flags, and the "all ready" start condition.
- **Session events** (via `useChorusSession`): `toggleParticipantReady` and `startSession`.
- **Local participant** (via `useLocalParticipant`): to mark the local row "(you)" and gate the Ready/Start buttons.

```tsx
import { SessionLobby } from 'chorus';

const session = chorus.createTurnSession<MyStatus, MyTurnData>({
    name: 'my-session',
    defaultValue: null,
    participantStorageKey: 'player', // (default) enables currentParticipantId ("you") detection
    ...
});

const MyLobby = () => (
    <session.Provider>
        <SessionLobby />
    </session.Provider>
);
```

| Context dependency (no props) | Source                                     |
| ----------------------------- | ------------------------------------------ |
| `participants`                | `useSessionState` → `state.participants`   |
| `currentParticipantId`        | `useLocalParticipant` → `participant.id`   |
| `onToggleReady`               | `events.toggleParticipantReady`            |
| `onStart`                     | `events.startSession`                      |
| `canStart`                    | All participants' `ready` flags are `true` |

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

## Turn Layer (Opt-in)

Chorus ships with an optional **turn layer** for turn-based collaborative apps (storytelling, scrum planning, etc.). It wraps `createSession` with turn-session semantics while remaining fully generic over the app-specific turn status values and per-participant data.

### Generic types

```typescript
interface Participant {
    id: string;
    name: string;
    ready: boolean;
}

interface Turn<TStatus extends string, TTurnData> {
    status: TStatus; // app-specific turn status
    participants: { [participantId: string]: TTurnData }; // app-specific per-participant data
}

type SessionStatus = 'lobby' | 'running' | 'finished'; // fixed enum

interface TurnSessionState<TStatus extends string, TTurnData> {
    id: string;
    participants: { [participantId: string]: Participant };
    turns: Turn<TStatus, TTurnData>[];
    status: SessionStatus;
    createdAt: number;
}
```

### createTurnSession

```typescript
const session = chorus.createTurnSession<MyTurnStatus, MyPlayerTurn>({
    name: 'my-turn-session',
    defaultValue: null,
    checksum: computeTurnSessionChecksum,   // (default) divergence detection
    api: {
        // app-specific P2P-synced reducers
        vote: (state, payload) => { ... },
    },
});
```

`createTurnSession` returns the same session API as `createSession`, plus these **generic turn events**:

| Event                    | Payload                                   | Description                                  |
| ------------------------ | ----------------------------------------- | -------------------------------------------- |
| `updateState`            | `TurnSessionState`                        | Replace the whole session state              |
| `toggleParticipantReady` | `string` (participant id)                 | Toggle a participant's ready flag            |
| `startSession`           | —                                         | Advance session status to `'running'`        |
| `endSession`             | —                                         | Advance session status to `'finished'`       |
| `addTurn`                | `Turn<TStatus, TTurnData>`                | Append a turn to the session                 |
| `joinParticipant`        | `Participant`                             | Add a participant (no-op if already present) |
| `updateTurnParticipants` | `{ [participantId]: Partial<TTurnData> }` | Merge partial updates into the current turn  |

### Turn-aware workflows

Unlike `createSession`, the default `getStatus`/`setStatus` in `createTurnSession` target the **current turn's status** rather than a top-level `status` field. The top-level session status remains the fixed `'lobby' | 'running' | 'finished'` enum (managed by `startSession`/`endSession`).

```typescript
session.workflows({
    transitions: [
        {
            from: 'discuss',
            filter: ({ state }) => allVoted(state),
            next: 'revealed',
        },
    ],
});
```

### createParticipantStore

A generic local participant store (the "active participant" of the session), persisted in localStorage:

```typescript
import { createParticipantStore } from 'chorus';

const { $participant, setParticipantName } = createParticipantStore('player');
```

### Example: Scrum Planning

```typescript
type ScrumStatus = 'discuss' | 'vote' | 'revealed';

interface ScrumPlayerTurn {
    playerId: string;
    vote?: number;
}

const session = chorus.createTurnSession<ScrumStatus, ScrumPlayerTurn>({
    name: 'scrum',
    defaultValue: {
        id: 'scrum-1',
        participants: {},
        turns: [],
        status: 'lobby',
        createdAt: Date.now(),
    },
    api: {
        vote: (state, { playerId, vote }) => { ... },
    },
});

// Join participants
session.events['joinParticipant']({ id: 'dev-1', name: 'Alice', ready: false });

// Start the session
session.events['startSession']();

// Add a planning round
session.events['addTurn']({
    status: 'discuss',
    participants: { 'dev-1': { playerId: 'dev-1' } },
});

// Vote
session.events['vote']({ playerId: 'dev-1', vote: 5 });
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
├── turn/                 ← optional turn layer (opt-in)
│   ├── types.ts          ← Participant, Turn, TurnSessionState, SessionStatus
│   ├── createTurnSession.ts ← createTurnSession factory
│   ├── participant.ts    ← createParticipantStore
│   ├── checksum.ts       ← computeTurnSessionChecksum
│   └── hooks.ts          ← useTurn, useTurnStatus, useParticipantTurn, ...
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
