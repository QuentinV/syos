# Chorus

> Decentralized, serverless P2P state synchronization for React, built on [effector](https://effector.dev) + [PeerJS](https://peerjs.com).

[![npm version](https://img.shields.io/npm/v/@quentinv/chorus.svg)](https://www.npmjs.com/package/@quentinv/chorus)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PeerJS](https://img.shields.io/badge/transport-WebRTC-blue.svg)](https://peerjs.com)

Chorus lets you create **synchronized state containers** ("sessions") that automatically stay in sync across all connected peers over WebRTC — **no backend server required**. Just a PeerJS signaling server (default: `0.peerjs.com`) to bootstrap the WebRTC connections.

---

## Features

- 🚀 **Zero-backend sync** — state broadcasts over WebRTC data channels; the only server is a lightweight PeerJS signaling server.
- 🧠 **Effector-powered** — sessions are effector stores; reducers, events, and derived state work exactly as you'd expect.
- 🔄 **Deterministic ordering** — Lamport clocks + buffered reordering guarantee all peers apply events in the same order.
- 🔁 **Reconnection support** — an append-only event log lets reconnecting peers replay missed events and catch up.
- 🧩 **Generic React components** — QRCode, Countdown, DebugPanel, SessionLobby, JoinSession, SessionPage.
- 🎯 **Optional turn layer** — a fully generic turn-based session model (participants, turns, current-turn status) for collaborative apps like scrum planning or storytelling.
- 🛠 **Workflow engine** — a declarative state machine for advancing session status.
- 💾 **Pluggable storage** — IndexedDB (default), localStorage, or in-memory.
- 🐞 **Built-in debug panel** — inspect P2P messages, Lamport clock, checksums, and live state.

---

## Installation

```bash
# yarn
yarn add @quentinv/chorus

# npm
npm install @quentinv/chorus

# pnpm
pnpm add @quentinv/chorus
```

**Peer dependencies** (must be installed in your app):

```bash
yarn add react react-dom effector effector-react
```

### Styles

Chorus components ship with their own styles. Import the stylesheet once in your app entry point:

```tsx
import '@quentinv/chorus/style.css';
```

> **Note:** The stylesheet is required for the components (`QRCode`, `Countdown`, `DebugPanel`, `SessionLobby`, `JoinSession`) to render correctly.

---

## Quick Start

```tsx
import { createChorus } from '@quentinv/chorus';

// 1. Create a Chorus instance
const chorus = createChorus({
    peerHost: '0.peerjs.com', // PeerJS signaling server
    storage: 'indexeddb', // 'indexeddb' | 'memory' | 'localstorage'
    debug: true, // enable the debug stores/panel
});

// 2. Define a session (one synchronized state container)
type CounterState = { id: string; count: number } | null;

const session = chorus.createSession<CounterState>({
    name: 'counter', // unique session name (storage key)
    defaultValue: { id: 'counter-1', count: 0 },
    api: {
        increment: (state, by: number) =>
            state ? { ...state, count: state.count + by } : null,
        reset: () => ({ id: 'counter-1', count: 0 }),
    },
});

// 3. Host initializes the session
session.init('counter-1');

// 4. Fire events — automatically broadcast to all connected peers
session.events.increment(5);

// 5. Read state imperatively
const state = session.$state.getState();

// 6. Or reactively with hooks
const Counter = () => {
    const state = session.useStore();
    return <div>Count: {state?.count}</div>;
};
```

That's it — every peer that joins the session stays in sync automatically.

---

## Core Concepts

### Sessions

A **session** is a single synchronized state container. You create one per logical piece of shared state (a game, a planning board, a document). Each session has:

- a **name** (used as the storage key),
- a **default value**,
- an **`api`** of P2P-synced reducers (each becomes an effector event),
- optional **checksum** for divergence detection.

### P2P Sync

When a reducer fires, Chorus:

1. Updates the local effector store.
2. Broadcasts the event to all connected peers.
3. Each peer applies the event through its own reducer.

Because every peer runs the same reducers on the same ordered events, all states converge.

### Deterministic Ordering (Lamport Clocks)

Every message is stamped with a monotonic Lamport clock. Incoming messages are buffered and reordered by `(clock, peerId)` before being applied, so all peers apply events in the **same order** — even when messages arrive out of order.

### Reconnection

An append-only event log (in IndexedDB) records every applied event. When a peer reconnects, it requests missed events since its last known clock and replays them to catch up.

---

## Hooks

Chorus provides two families of hooks: **session context hooks** (available in any session `Provider`) and **turn hooks** (available only in a turn session `Provider`).

### Session Context Hooks

These read directly from the session context, so you don't need to manually call `useChorusSession()` + `useUnit()`.

```tsx
import {
    useSessionState,
    useSessionId,
    useSessionPeerId,
} from '@quentinv/chorus';

const MyComponent = () => {
    const state = useSessionState<MyState>();
    const sessionId = useSessionId();
    const peerId = useSessionPeerId();

    return (
        <div>
            Session {sessionId} — Peer {peerId}
            <pre>{JSON.stringify(state, null, 2)}</pre>
        </div>
    );
};
```

| Hook                 | Returns          | Description                   |
| -------------------- | ---------------- | ----------------------------- |
| `useSessionState<T>` | `T`              | The session state store value |
| `useSessionId`       | `string \| null` | The active session id         |
| `useSessionPeerId`   | `string \| null` | This peer's id                |

> All session context hooks **throw** if used outside a session `Provider`.

### Accessing the Raw Context

For advanced use cases (e.g. reading the join URL or firing events), use `useChorusSession`:

```tsx
import { useUnit } from 'effector-react';
import { useChorusSession } from '@quentinv/chorus';

const ShareLink = () => {
    const { sessionId, getJoinUrl, $peerId, events } = useChorusSession();
    const peerId = useUnit($peerId);
    const url = getJoinUrl(sessionId, peerId);

    return (
        <a href={url} onClick={() => events.increment(1)}>
            {url}
        </a>
    );
};
```

### Turn Hooks

For turn-based sessions, `createTurnSession` returns **typed hooks** — stable closures that capture your `TStatus`/`TTurnData` types, so no type parameters are needed at call sites.

```tsx
const session = chorus.createTurnSession<MyStatus, MyTurnData>({ ... });

const TurnView = ({ participantId }) => {
    const turn = session.useTurn();                       // current (last) turn
    const previousTurn = session.usePreviousTurn();       // second-to-last turn
    const status = session.useTurnStatus();               // current turn's status
    const myTurn = session.useParticipantTurn(participantId);
    const allTurns = session.useTurnParticipants();
    const hostTurn = session.useTurnParticipantByPredicate(
        (turn) => turn.isHost
    );
    const localTurn = session.useLocalParticipantTurn();  // requires participantStorageKey
    const me = session.useLocalParticipant();             // { id, name, ready }

    return <div>{status}</div>;
};
```

| Hook                                | Returns                    | Description                                                                    |
| ----------------------------------- | -------------------------- | ------------------------------------------------------------------------------ |
| `useTurn()`                         | `Turn<T, D> \| undefined`  | The current (last) turn                                                        |
| `usePreviousTurn()`                 | `Turn<T, D> \| undefined`  | The previous (second-to-last) turn                                             |
| `useTurnStatus()`                   | `T \| null`                | The current turn's status                                                      |
| `useParticipantTurn(participantId)` | `D \| undefined`           | A participant's turn data in the current turn                                  |
| `useTurnParticipants()`             | `{ [id]: D }`              | All participants' turn data in the current turn                                |
| `useTurnParticipantByPredicate(fn)` | `D \| undefined`           | Find a participant's turn data by predicate                                    |
| `useLocalParticipantTurn()`         | `D \| undefined`           | The local participant's turn data (requires `participantStorageKey`)           |
| `useLocalParticipant()`             | `Participant \| undefined` | The local participant `{ id, name, ready }` (requires `participantStorageKey`) |

> **Note:** Turn hooks must be used within a **turn session** `Provider` (the one returned by `createTurnSession`). Plain `createSession` providers do not expose turn hooks.

You can also access the typed hooks from any component inside the turn `Provider` via `useChorusTurn`:

```tsx
import { useChorusTurn } from '@quentinv/chorus';

const MyComponent = () => {
    const { useTurn, useParticipantTurn } = useChorusTurn<
        MyStatus,
        MyTurnData
    >();
    const turn = useTurn();
    return <div>{turn?.status}</div>;
};
```

---

## Components

Chorus ships with generic, UI-framework-agnostic React components for common P2P session patterns.

### QRCode

Renders a QR code for the active session's join URL. Reads `sessionId`, `peerId`, and `getJoinUrl` from the session context. Clicking the QR code copies the join URL to the clipboard.

```tsx
import { QRCode } from '@quentinv/chorus';

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
import { Countdown } from '@quentinv/chorus';

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
import { DebugPanel } from '@quentinv/chorus';

<DebugPanel state={myState} />;
```

| Prop     | Type  | Description                           |
| -------- | ----- | ------------------------------------- |
| `state?` | `any` | Current session state (shown as JSON) |

> `peerId` and the live checksum are computed internally from the session context and debug stores — no props needed.

### SessionLobby

A generic session lobby showing connected participants, ready status, and a join QR code. Takes **no props** — it reads everything from the turn-session context.

```tsx
import { SessionLobby } from '@quentinv/chorus';

const session = chorus.createTurnSession<MyStatus, MyTurnData>({
    name: 'my-session',
    defaultValue: null,
    // participantStorageKey: 'participant', // default — enables "(you)" detection
});

const MyLobby = () => (
    <session.Provider>
        <SessionLobby />
    </session.Provider>
);
```

### SessionPage

A thin wrapper that auto-initializes a session on mount. Useful for host pages that need to call `session.init(id)` when the page loads.

```tsx
import { SessionPage } from '@quentinv/chorus';

<SessionPage id="session-123" initSession={(id) => session.init(id)}>
    <MyGame />
</SessionPage>;
```

| Prop          | Type                   | Description                                               |
| ------------- | ---------------------- | --------------------------------------------------------- |
| `id?`         | `string`               | Session id. When not provided, the init effect is skipped |
| `init?`       | `boolean`              | Whether to auto-init the session (default: `true`)        |
| `initSession` | `(id: string) => void` | Host-side init callback (e.g. the session `init` event)   |
| `children?`   | `React.ReactNode`      | Content rendered once the session is initialized          |

### JoinSession

A generic "connecting" screen shown while a participant joins a session via a P2P link.

```tsx
import { JoinSession } from '@quentinv/chorus';

<JoinSession
    sessionId="session-123"
    peerId="peer-abc"
    participantName="Alice"
/>;
```

| Prop               | Type     | Description                  |
| ------------------ | -------- | ---------------------------- |
| `sessionId?`       | `string` | The session ID being joined  |
| `peerId?`          | `string` | The host peer ID             |
| `participantName?` | `string` | The local participant's name |

---

## Turn Layer (Opt-in)

Chorus ships with an optional **turn layer** for turn-based collaborative apps (storytelling, scrum planning, etc.). It wraps `createSession` with turn-session semantics while remaining fully generic over your app-specific turn status values and per-participant data.

### Generic Types

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
    checksum: computeTurnSessionChecksum, // (default) divergence detection
    participantStorageKey: 'player',      // (default: 'participant') localStorage key for the local participant
    autoJoinParticipant: true,            // (default: true) auto-add the local participant to the session
    api: {
        // app-specific P2P-synced reducers
        vote: (state, payload) => { ... },
    },
});
```

| Config option           | Type      | Default         | Description                                                                      |
| ----------------------- | --------- | --------------- | -------------------------------------------------------------------------------- |
| `participantStorageKey` | `string`  | `'participant'` | localStorage key for the local participant store                                 |
| `autoJoinParticipant`   | `boolean` | `true`          | When true, the local participant is automatically added to the session if absent |

`createTurnSession` returns the same session API as `createSession`, plus these **generic turn events** and the **typed turn hooks** (see [Turn Hooks](#turn-hooks)). It also exposes a `participantStore` property and a `Provider` that composes the session context with the dedicated turn context.

| Event                    | Payload                                   | Description                                  |
| ------------------------ | ----------------------------------------- | -------------------------------------------- |
| `updateState`            | `TurnSessionState`                        | Replace the whole session state              |
| `toggleParticipantReady` | `string` (participant id)                 | Toggle a participant's ready flag            |
| `startSession`           | —                                         | Advance session status to `'running'`        |
| `endSession`             | —                                         | Advance session status to `'finished'`       |
| `addTurn`                | `Turn<TStatus, TTurnData>`                | Append a turn to the session                 |
| `joinParticipant`        | `Participant`                             | Add a participant (no-op if already present) |
| `updateTurnParticipants` | `{ [participantId]: Partial<TTurnData> }` | Merge partial updates into the current turn  |

### Turn-aware Workflows

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
import { createParticipantStore } from '@quentinv/chorus';

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
        vote: (state, { playerId, vote }) => {
            if (!state) return null;
            // merge the vote into the current turn's participant data
            return {
                ...state,
                turns: state.turns.map((turn, i) =>
                    i === state.turns.length - 1
                        ? {
                              ...turn,
                              participants: {
                                  ...turn.participants,
                                  [playerId]: {
                                      ...turn.participants[playerId],
                                      vote,
                                  },
                              },
                          }
                        : turn
                ),
            };
        },
    },
});

// Join participants
session.events.joinParticipant({ id: 'dev-1', name: 'Alice', ready: false });

// Start the session
session.events.startSession();

// Add a planning round
session.events.addTurn({
    status: 'discuss',
    participants: { 'dev-1': { playerId: 'dev-1' } },
});

// Vote
session.events.vote({ playerId: 'dev-1', vote: 5 });
```

---

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

---

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

---

## Storage Adapters

| Adapter        | Description                                                       |
| -------------- | ----------------------------------------------------------------- |
| `indexeddb`    | Default. Persists state to IndexedDB with sessionStorage fallback |
| `memory`       | In-memory Map. Useful for tests and non-browser environments      |
| `localstorage` | Persists state to localStorage                                    |

---

## Debugging

Enable the debug stores and use the built-in `DebugPanel` component to inspect P2P messages, Lamport clock, checksums, and live state.

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

```tsx
import { DebugPanel } from '@quentinv/chorus';

<DebugPanel state={myState} />;
```

---

## How It Works

1. **Lamport clock ordering** — Every message is stamped with a monotonic clock. Incoming messages are buffered and reordered by `(clock, peerId)` before being applied, ensuring deterministic ordering across all peers.

2. **P2P sync** — When a reducer fires, it updates local state and broadcasts the event to all connected peers. Peers apply the event through their own reducer, keeping all states in sync.

3. **Reconnection** — An append-only event log in IndexedDB enables reconnecting peers to replay missed events and catch up.

4. **Heartbeat** — Peers send periodic pings. Peers that don't respond within 15 seconds are considered disconnected and removed.

5. **Checksums** — Optional `checksum` function detects state divergence between peers.

---

## Architecture

```
src/chorus/
├── index.ts              ← public entry
├── core/
│   ├── createChorus.ts   ← main factory
│   ├── connection.ts     ← ChorusConnection (PeerJS transport)
│   ├── session.ts        ← ChorusSession (effector store + P2P reducers)
│   ├── storage.ts        ← storage adapters
│   ├── context.ts        ← session React context + hooks
│   ├── types.ts          ← shared types
│   └── workflow.ts       ← generic workflow engine
├── debug/
│   ├── debug.ts          ← debug stores
│   └── eventLog.ts       ← append-only event log
├── turn/                 ← optional turn layer (opt-in)
│   ├── types.ts          ← Participant, Turn, TurnSessionState, SessionStatus
│   ├── createTurnSession.ts ← createTurnSession factory
│   ├── participant.ts    ← createParticipantStore
│   ├── checksum.ts       ← computeTurnSessionChecksum
│   └── hooks.ts          ← useTurn, useTurnStatus, useParticipantTurn, ...
```

---

## Limitations

- Event log is best-effort (IndexedDB writes may fail silently).
- No CRDT-level conflict resolution — relies on per-slot writes to avoid conflicts.
- Requires a PeerJS signaling server (default: `0.peerjs.com`).

---

## License

[MIT](./LICENSE)
