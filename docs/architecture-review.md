# syos — Architecture Review & Improvements

> A decentralized peer-to-peer scrum/storytelling game built with effector + PeerJS.
> This document captures architectural observations, potential issues, and improvement ideas.

---

## 1. Core Concept Assessment

### What's innovative

The `DSStore` abstraction — wrapping effector stores with automatic WebRTC broadcast — is a genuinely novel approach. The developer experience of writing a reducer once and getting both local state update + P2P sync + IndexedDB persistence is elegant and productive.

### What's solid

- **Per-player state isolation**: Gremlins each write to their own `PlayerTurn.playerId` slot. No two peers ever modify the same object key concurrently, which sidesteps the need for CRDT-level conflict resolution.
- **Turn-based constraints**: The game's sequential turn structure (stPicksCards → stWriteStory → pEstimate → pPicksCards → turnEnded) naturally limits concurrency issues.
- **Single writer for turn progression**: Only the storyteller's client evaluates workflow transitions and advances `turn.status`. This avoids the "everyone advances simultaneously" race condition.

---

## 2. Identified Issues

### 2.1 Event Ordering (Multi-Source)

**Problem**: Even with ordered WebRTC data channels per-connection, events from different sources can arrive in different orders on different peers. Example:

```
Peer A emits eventX
Peer B emits eventY
     ↓
Peer C sees: eventX → eventY
Peer D sees: eventY → eventX
```

**Impact**: Low for this game, since each peer writes to its own state slot. But if two events ever touch overlapping state, peers will diverge.

**Potential fix**: Lamport clock (monotonic counter) attached to every event. Peers buffer out-of-order events and apply them in sequence. This guarantees all peers apply events in the same global order.

### 2.2 Reconnection & State Reconciliation

**Problem**: When a peer reconnects, they receive a single `setState` snapshot from one connected peer. There is no:

- Verification that the snapshot is the latest
- Mechanism to replay missed events
- Way to detect if the snapshot is stale

**Impact**: Medium. A reconnecting peer might get an outdated state if the responding peer hasn't yet received the latest events.

**Potential fix**: Add an event log (append-only, stored in IndexedDB). On reconnection, request events since the reconnecting peer's last known timestamp. This also enables late-joining peers to "catch up."

### 2.3 Workflow Execution Model

**Problem**: Workflow transitions in `workflows.ts` are only evaluated on the storyteller's client (line 137: `if (playerTurn?.role !== PlayerRole.storyteller) return false`). This means:

- If the storyteller disconnects mid-turn, the game stalls
- The storyteller becomes a de facto leader — not truly decentralized, but still serverless

**Impact**: Medium. Works fine while the storyteller stays connected, but creates a single point of failure.

**Potential fixes**:

- **Leader election fallback**: If the storyteller disconnects, elect a new leader (e.g., the player who joined earliest) to take over workflow evaluation.
- **Distributed consensus**: All peers evaluate workflows independently. Since they all have the same state (assuming ordering is solved), they should all reach the same conclusion. Use a simple majority or "first to advance wins" with idempotent transitions.
- **Keep current model but add heartbeat**: The storyteller sends periodic heartbeats. If missing for N seconds, another peer takes over.

### 2.4 No State Divergence Detection

**Problem**: There's no mechanism to detect if peers have diverged. If a bug or race condition causes different states, it goes unnoticed.

**Impact**: Low for a party game (worst case: refresh the page), but makes debugging difficult.

**Potential fix**: After each event, broadcast a checksum (e.g., simple hash of the game state). Peers compare checksums. On mismatch, log the divergence and optionally request a full sync.

### 2.5 Initial Connection Handshake

**Problem**: The current handshake is minimal:

1. Joining peer connects to the host peer
2. Host sends `setState` with their current state
3. Joining peer applies it

There's no:

- Version negotiation
- State validation
- Retry logic if the initial `setState` message is lost

**Impact**: Low-medium. Works in practice but fragile.

**Potential fix**: Add a simple request/response handshake with acknowledgments.

---

## 3. Improvement Ideas

### 3.1 Event Log (Append-Only History)

Store every event in an append-only log in IndexedDB:

```typescript
interface EventLogEntry {
    id: string; // uuid
    timestamp: number; // Lamport clock value
    peerId: string; // who emitted it
    eventName: string; // 'setDisplayedCards', 'selectCard', etc.
    payload: any; // the event payload
    stateChecksum: string; // hash of state after applying this event
}
```

Benefits:

- Reconnecting peers can replay missed events
- Debugging: full audit trail of state changes
- Could enable "rewind" functionality for testing

### 3.2 Lamport Clock for Event Ordering

```typescript
// Each peer maintains a counter
let lamportClock = 0;

// Before broadcasting an event:
lamportClock++;
event.data.clock = lamportClock;

// On receiving an event:
lamportClock = Math.max(lamportClock, receivedClock) + 1;
// Buffer and reorder events by clock value
```

This ensures a consistent global ordering across all peers without a central coordinator.

### 3.3 Graceful Leader Transition

If the storyteller disconnects, the remaining peers should elect a new leader:

```typescript
// Simple deterministic election: lowest peerId wins
const electLeader = (players: Player[]): string => {
    return players.sort((a, b) => a.id.localeCompare(b.id))[0].id;
};
```

The new leader takes over workflow evaluation. This requires the workflow to be idempotent (safe to run multiple times).

### 3.4 State Checksum Verification

```typescript
const simpleHash = (state: Game): string => {
    return (
        JSON.stringify(state).length +
        '_' +
        Object.keys(state.players).sort().join(',')
    );
};

// After each event, broadcast checksum
// Peers compare and log divergences
```

Simple but effective for detecting issues during development.

---

## 4. Design Decisions to Keep

| Decision                        | Rationale                                                                   |
| ------------------------------- | --------------------------------------------------------------------------- |
| **effector as state engine**    | Events, stores, and `sample()` map naturally to the P2P event model         |
| **Per-player state slots**      | Eliminates concurrent write conflicts — each peer owns its own `PlayerTurn` |
| **Storyteller-driven workflow** | Simple, predictable, and avoids distributed consensus complexity            |
| **IndexedDB persistence**       | Enables offline recovery and reconnection without full replay               |
| **PeerJS for WebRTC**           | Mature library, handles STUN/TURN, simple API                               |

---

## 5. Open Questions

1. **Should we add a Lamport clock?** The game might work fine without it given per-player state isolation. But it's a cheap safety net.

2. **Should workflow evaluation be distributed or leader-based?** Leader-based is simpler. Distributed is more resilient. For a party game, leader-based is probably sufficient.

3. **How important is reconnection support?** For a team-building game played in one session, maybe not critical. But it would make the experience more robust.

4. **Should we add state checksums?** Mostly useful for debugging. Could be gated behind a debug flag.

---

## 6. Priority Order for Fixes

1. **Workflow resilience** — Handle storyteller disconnection gracefully (leader election fallback)
2. **Event ordering** — Add Lamport clock to prevent subtle race conditions
3. **Reconnection protocol** — Event log + catch-up replay
4. **State divergence detection** — Checksum verification (debug mode)
5. **Handshake robustness** — Ack-based connection protocol

---

_Document generated from architectural review — July 2026_
