# Chorus — Decentralized P2P State Library

> Plan for extracting the generic P2P state-sync engine from syos into a reusable library called **Chorus**.

## Goal

Extract the generic P2P state-sync engine from `src/utils/dsApi.ts` (plus the generic helpers: event log, workflows, debug) into a reusable library called **Chorus**, living at `src/chorus/`. Refactor syos to consume it. All 62 existing tests must keep passing.

## Public API (target)

```typescript
// Entry point
const chorus = createChorus({
    peerHost: '0.peerjs.com',   // single option for PeerJS server host
    debug: true,                // enable debug panel stores
    storage: 'indexeddb',       // 'indexeddb' | 'memory' | 'localstorage'
});

// A session = one synchronized state container
const session = chorus.createSession<MyState>({
    name: 'my-session',         // was dbStoreName
    defaultValue: null,
    api: { ... },               // KEPT as 'api'
    checksum: (state) => hash(state),  // was computeChecksum
});

// Session API (mirrors current DX)
session.store                  // register reducers (.on / .localOn)
session.$state                 // effector store
session.$peerId
session.init(id)               // host init
session.joinFx({ objectId, peerId })
session.useStore()             // React hook
session.usePeerId()
session.events                 // mapped effector events

// Workflows — flexible, generic engine
session.workflows({
    from: 'stPicksCards',
    context: (state) => ({ game: state, turn: state.turns.at(-1), ... }), // flexible
    filter: (ctx) => ...,
    logic: (ctx) => ...,
    next: 'stWriteStory',
});

// Debugging — lifted from game layer
const debug = chorus.debug;    // $messages, $panelOpen, $clock, clear(), togglePanel()
```

## Naming decisions

- `peerId` stays (WebRTC concept)
- `api` kept instead of `reducers`
- `dbStoreName` → `name`
- `computeChecksum` → `checksum`
- `DSConnection` → `ChorusConnection`
- `DSStore` → `ChorusSession`
- `createDSApi` → `createChorus` + `createSession`
- "player" never appears in the library layer — it's only in game types, so no rename needed there

## Module layout

```
src/chorus/
├── index.ts              ← public entry: createChorus, types, re-exports
├── types.ts              ← Message, PeerInfo, SessionConfig, Reducer, Workflow...
├── core/
│   ├── createChorus.ts   ← main factory (createChorus + createSession)
│   ├── connection.ts     ← ChorusConnection (transport: PeerJS, heartbeat, peers)
│   ├── session.ts        ← ChorusSession (effector store + P2P reducers + clock)
│   └── storage.ts        ← IndexedDB + sessionStorage + memory adapters
├── eventLog.ts           ← append-only log (already generic)
├── workflow.ts           ← generic workflow engine (flexible context)
├── debug.ts              ← debug stores (messages, panel, clock, checksum)
└── react.ts              ← useUnit-based hooks
```

## Implementation steps

### Step 1 — Plan document

Write this plan to `docs/chorus-plan.md`.

### Step 2 — `src/chorus/types.ts`

Move generic types: `Message`, `PeerInfo`, `PeerObjectData`, `PeersInfos`, `Reducer`, `StateWithId`, `SessionConfig`, `WorkflowTransition`, `DebugMessage`. Export from here.

### Step 3 — `src/chorus/core/storage.ts`

Extract `openDb`, `execQuery`, `put`, `get` from dsApi.ts. Add a `memory` adapter (in-memory Map) so tests and non-browser environments work without IndexedDB. Keep `sessionStorage` fallback.

### Step 4 — `src/chorus/core/connection.ts`

Extract `DSConnection` → `ChorusConnection`. Make `peerHost` configurable (from `createChorus` options). Keep: Lamport clock, event buffer, peer data persistence, heartbeat, connectToPeer, initPeerConnection, broadcastMessage.

### Step 5 — `src/chorus/core/session.ts`

Extract `DSStore` → `ChorusSession`. Keep `on()`/`localOn()`, `setState` handling, checksum broadcast. Rename `dbStoreName` → `name`, `computeChecksum` → `checksum`.

### Step 6 — `src/chorus/core/createChorus.ts`

The main factory. `createChorus(options)` returns `{ createSession, debug, ... }`. `createSession(config)` builds the effector store, wires `ChorusConnection` + `ChorusSession`, returns the session API (mirroring current `createDSApi` return shape). Move `processMessage`/`rawProcessMessage` logic here (it's per-session).

### Step 7 — `src/chorus/eventLog.ts`

Copy `eventLog.ts` as-is (already generic). Re-export.

### Step 8 — `src/chorus/workflow.ts`

Generic workflow engine. Design:

- `session.workflows(transitions)` registers transitions
- Each transition: `{ from, context?, filter, logic?, next }`
- `context` is a flexible function `(state) => any` that derives the context object passed to `filter`/`logic`. Defaults to `(state) => ({ state })`.
- Internally uses `sample()` on the session's `$state`, mirroring current `workflows.ts` logic but without game-specific `status === 'running'` or `player` assumptions.

### Step 9 — `src/chorus/debug.ts`

Extract `debug.ts` (messages, panel, clock, checksum stores). Make it generic (no `Message` import from game). `createChorus({ debug: true })` wires `onMessage` to log into these stores.

### Step 10 — `src/chorus/react.ts`

Extract `useUnit`-based hooks: `useStore`, `usePeerId` (returned by session). Keep generic.

### Step 11 — `src/chorus/index.ts`

Public entry: export `createChorus`, all types, `Message`, `WorkflowTransition`, etc.

### Step 12 — Refactor syos to consume Chorus

- `src/state/game.ts` → use `createChorus().createSession<Game | null>({ name: 'games', ... })`
- `src/state/init.ts` → update imports
- `src/state/workflows.ts` → use `session.workflows([...])` with flexible `context` deriving `{ game, turn, playerTurn, player }`
- `src/state/debug.ts` → use `chorus.debug` (or keep a thin wrapper)
- `src/state/gameHooks.ts` → update imports
- `src/utils/dsApi.ts` → remove (replaced by Chorus)
- `src/utils/eventLog.ts` → remove (moved to Chorus)
- `src/utils/__tests__/mockPeer.ts` → update imports (types from chorus)

### Step 13 — Tests

- Port existing tests to import from `src/chorus/` where they referenced `dsApi`
- Add new Chorus API tests:
    - `createChorus` returns `createSession` + `debug`
    - `createSession` with `api` reducers works (broadcast suppression, idempotency)
    - `session.workflows()` generic engine (non-game example)
    - `storage: 'memory'` adapter works without IndexedDB
    - `peerHost` config is used
- Keep all 62 existing tests passing

### Step 14 — Docs

- `docs/chorus-plan.md` (this plan, marked complete)
- `docs/chorus.md` — public API reference + minimal non-game example (e.g., a shared counter or collaborative list)

### Step 15 — Verify

- `yarn test` → all tests pass
- `yarn build` → builds cleanly
- `yarn eslint` → no new lint errors

## Out of scope (future)

- Publishing to npm as a separate package
- CRDT-level conflict resolution (per-slot writes already avoid this)
- Guaranteed event log durability (documented limitation)
