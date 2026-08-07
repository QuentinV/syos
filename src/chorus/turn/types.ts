/**
 * Generic turn-based session types.
 *
 * These types are app-agnostic: any turn-based collaborative app
 * (storytelling, scrum planning, etc.) can use them by providing
 * its own `TStatus` (turn status values) and `TTurnData` (per-player
 * data within a turn).
 */

/** A participant in a turn-based session. */
export interface Participant {
    id: string;
    name: string;
    ready: boolean;
}

/** A single turn. `TStatus` is the app-specific turn status; `TTurnData` is the per-participant data. */
export interface Turn<TStatus extends string, TTurnData> {
    status: TStatus;
    participants: { [participantId: string]: TTurnData };
}

/** Global session lifecycle status (fixed enum). */
export type SessionStatus = 'lobby' | 'running' | 'finished';

/** The full state of a turn-based session. */
export interface TurnSessionState<TStatus extends string, TTurnData> {
    id: string;
    participants: { [participantId: string]: Participant };
    turns: Turn<TStatus, TTurnData>[];
    status: SessionStatus;
    createdAt: number;
}
