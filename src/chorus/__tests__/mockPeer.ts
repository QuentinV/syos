export type MessageHandler = (message: {
    type: string;
    data?: any;
    clock?: number;
    peerId?: string;
    checksum?: string;
}) => void;

/**
 * In-memory mock of a PeerJS peer for testing P2P sync without WebRTC.
 * Each MockPeer has its own state and can connect to other peers.
 *
 * Now supports Lamport clock-based ordering: messages are stamped with
 * a monotonic clock and reordered on receive based on (clock, peerId).
 */
export class MockPeer<T> {
    public peerId: string;
    public state: T | null = null;
    public connectedPeers: Map<string, MockPeer<T>> = new Map();
    public messageLog: { from: string; message: any }[] = [];
    public isDisconnected = false;
    public dropNextMessage = false;
    public onMessage: MessageHandler | null = null;
    public onConnection: ((peer: MockPeer<T>) => void) | null = null;

    // Lamport clock
    public lamportClock = 0;
    private eventBuffer: {
        from: string;
        message: {
            type: string;
            data?: any;
            clock: number;
            peerId: string;
            checksum?: string;
        };
    }[] = [];
    private flushTimeoutId: ReturnType<typeof setTimeout> | null = null;

    // Event log for reconnection support
    public eventLog: {
        id: string;
        clock: number;
        peerId: string;
        eventName: string;
        payload: any;
        timestamp: number;
    }[] = [];

    // Connection health monitoring
    public lastSeen: number = Date.now();
    public isSilent = false; // When true, peer doesn't respond to pings
    private heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;
    private healthCheckIntervalId: ReturnType<typeof setInterval> | null = null;
    public onPeerDisconnected: ((peerId: string) => void) | null = null;

    // Checksum support for divergence detection (Fix A, B, C)
    public computeChecksum: ((state: T | null) => string) | null = null;
    public broadcastCount = 0;
    public divergenceWarnings: string[] = [];
    public lastBroadcastChecksum: string | null = null;

    constructor(peerId: string, initialState: T | null = null) {
        this.peerId = peerId;
        this.state = initialState;
    }

    connect(other: MockPeer<T>): void {
        if (this.isDisconnected) return;
        this.connectedPeers.set(other.peerId, other);
        other.connectedPeers.set(this.peerId, this);
        this.onConnection?.(other);
        other.onConnection?.(this);
    }

    disconnect(): void {
        this.isDisconnected = true;
        this.stopHeartbeat();
        this.connectedPeers.forEach((_, peerId) => {
            const peer = this.connectedPeers.get(peerId);
            if (peer) {
                peer.connectedPeers.delete(this.peerId);
            }
        });
        this.connectedPeers.clear();
        if (this.flushTimeoutId) {
            clearTimeout(this.flushTimeoutId);
            this.flushTimeoutId = null;
        }
    }

    /**
     * Simulate a silent disconnect — peer is still "connected" but
     * doesn't respond to pings. Used to test health monitoring.
     */
    simulateSilentDisconnect(): void {
        this.isSilent = true;
    }

    /**
     * Send a ping to all connected peers.
     */
    sendPing(): void {
        if (this.isDisconnected) return;
        this.connectedPeers.forEach((peer) => {
            if (peer.isDisconnected) return;
            peer.receiveMessage(this.peerId, {
                type: 'control',
                data: { action: 'ping' },
                peerId: this.peerId,
            });
        });
    }

    /**
     * Handle a ping by responding with pong (unless silent).
     */
    handlePing(fromPeerId: string): void {
        if (this.isSilent) return; // Silent peers don't respond
        const peer = this.connectedPeers.get(fromPeerId);
        if (peer && !peer.isDisconnected) {
            this.lastSeen = Date.now();
            peer.receiveMessage(this.peerId, {
                type: 'control',
                data: { action: 'pong' },
                peerId: this.peerId,
            });
        }
    }

    /**
     * Check health of all connected peers.
     * Returns list of peer IDs that have timed out.
     */
    checkPeerHealth(timeoutMs = 15000): string[] {
        const now = Date.now();
        const disconnected: string[] = [];
        this.connectedPeers.forEach((peer, peerId) => {
            if (now - peer.lastSeen > timeoutMs) {
                disconnected.push(peerId);
                this.connectedPeers.delete(peerId);
                this.onPeerDisconnected?.(peerId);
            }
        });
        return disconnected;
    }

    /**
     * Start sending heartbeats and checking peer health.
     */
    startHeartbeat(intervalMs = 5000): void {
        if (this.heartbeatIntervalId) return;
        this.heartbeatIntervalId = setInterval(() => {
            this.sendPing();
        }, intervalMs);
        this.healthCheckIntervalId = setInterval(() => {
            this.checkPeerHealth();
        }, intervalMs);
    }

    /**
     * Stop heartbeat intervals.
     */
    stopHeartbeat(): void {
        if (this.heartbeatIntervalId) {
            clearInterval(this.heartbeatIntervalId);
            this.heartbeatIntervalId = null;
        }
        if (this.healthCheckIntervalId) {
            clearInterval(this.healthCheckIntervalId);
            this.healthCheckIntervalId = null;
        }
    }

    reconnect(existingPeer: MockPeer<T>): void {
        this.isDisconnected = false;
        this.connect(existingPeer);

        // Request missed events since our last known clock
        const sinceClock = this.lamportClock;
        // Simulate the control message protocol
        // The reconnecting peer sends a catchUpRequest
        const missedEvents = existingPeer.eventLog.filter(
            (e) => e.clock > sinceClock
        );

        // Find the max clock among missed events to sync our clock
        let maxMissedClock = 0;
        for (const entry of missedEvents) {
            if (entry.clock > maxMissedClock) maxMissedClock = entry.clock;
        }

        // Sync our Lamport clock to at least the max clock we've seen
        if (maxMissedClock > 0) {
            this.lamportClock = Math.max(this.lamportClock, maxMissedClock);
        }

        // Apply missed events directly (bypass buffer since we're catching up)
        for (const entry of missedEvents) {
            const stamped = {
                type: 'event',
                data: { eventName: entry.eventName, payload: entry.payload },
                clock: entry.clock,
                peerId: entry.peerId,
            };
            this.messageLog.push({ from: entry.peerId, message: stamped });
            this.onMessage?.(stamped);
        }

        // Also send a requestState to get the current snapshot
        const stateSnapshot = {
            type: 'event',
            data: { eventName: 'setState', payload: existingPeer.getState() },
            clock: existingPeer.lamportClock,
            peerId: existingPeer.peerId,
        };
        this.messageLog.push({
            from: existingPeer.peerId,
            message: stateSnapshot,
        });
        this.onMessage?.(stateSnapshot);
    }

    /**
     * Broadcast a message to all connected peers with a Lamport clock stamp.
     * Also applies the event locally (simulating the real store behavior
     * where the reducer runs locally first, then broadcasts to peers).
     */
    broadcast(message: { type: string; data?: any }): void {
        if (this.isDisconnected) return;

        // Stamp with Lamport clock
        this.lamportClock++;
        const stamped: {
            type: string;
            data?: any;
            clock: number;
            peerId: string;
            checksum?: string;
        } = {
            ...message,
            clock: this.lamportClock,
            peerId: this.peerId,
        };

        // Apply locally first (simulates the local reducer execution)
        this.messageLog.push({ from: this.peerId, message: stamped });
        this.onMessage?.(stamped);

        // Compute checksum from the post-mutation state (Fix A: use new state, not old)
        if (this.computeChecksum && this.state) {
            stamped.checksum = this.computeChecksum(this.state);
            this.lastBroadcastChecksum = stamped.checksum;
        }

        this.broadcastCount++;

        // Then send to connected peers
        this.connectedPeers.forEach((peer) => {
            if (peer.isDisconnected) return;

            if (this.dropNextMessage) {
                this.dropNextMessage = false;
                return;
            }

            peer.receiveMessage(this.peerId, stamped);
        });
    }

    /**
     * Receive a message, buffer it, and attempt to apply in clock order.
     */
    receiveMessage(
        from: string,
        message: {
            type: string;
            data?: any;
            clock?: number;
            peerId?: string;
        }
    ): void {
        if (this.isDisconnected) return;

        // Update our Lamport clock: take the max of our clock and the received clock, then increment
        if (message.clock !== undefined) {
            this.lamportClock = Math.max(this.lamportClock, message.clock) + 1;
        }

        // Add to buffer with a default clock of 0 if not provided
        this.eventBuffer.push({
            from,
            message: {
                ...message,
                clock: message.clock ?? 0,
                peerId: message.peerId ?? from,
            },
        });

        this.tryFlushBuffer();
    }

    /**
     * Try to apply buffered events in order.
     * Events are ordered by (clock, peerId) to ensure deterministic ordering.
     * An event is ready to apply if its clock is exactly lastAppliedClock + 1,
     * or if we've waited long enough (gap handling via timeout).
     */
    private tryFlushBuffer(): void {
        // Sort by (clock, peerId) for deterministic ordering
        this.eventBuffer.sort((a, b) => {
            if (a.message.clock !== b.message.clock) {
                return a.message.clock - b.message.clock;
            }
            return a.message.peerId.localeCompare(b.message.peerId);
        });

        // Find the contiguous sequence starting from clock 1
        let lastAppliedClock = 0;
        const toApply: typeof this.eventBuffer = [];
        const remaining: typeof this.eventBuffer = [];

        for (const entry of this.eventBuffer) {
            if (entry.message.clock === lastAppliedClock + 1) {
                toApply.push(entry);
                lastAppliedClock = entry.message.clock;
            } else {
                remaining.push(entry);
            }
        }

        this.eventBuffer = remaining;

        // Apply in order
        for (const { from, message } of toApply) {
            this.messageLog.push({ from, message });
            this.onMessage?.(message);
        }

        // If there's a gap, schedule a flush attempt after a short delay
        if (this.eventBuffer.length > 0 && !this.flushTimeoutId) {
            this.flushTimeoutId = setTimeout(() => {
                this.flushTimeoutId = null;
                // Force apply all buffered events in sorted order
                this.eventBuffer.sort((a, b) => {
                    if (a.message.clock !== b.message.clock) {
                        return a.message.clock - b.message.clock;
                    }
                    return a.message.peerId.localeCompare(b.message.peerId);
                });
                for (const { from, message } of this.eventBuffer) {
                    this.messageLog.push({ from, message });
                    this.onMessage?.(message);
                }
                this.eventBuffer = [];
            }, 100);
        }
    }

    /**
     * Corrupt the local state to simulate divergence.
     */
    corruptState(overrides: Partial<T>): void {
        if (this.state) {
            this.state = { ...this.state, ...overrides };
        }
    }

    getState(): T | null {
        return this.state;
    }

    setState(state: T | null): void {
        this.state = state;
    }

    /**
     * Check if this peer's state matches another peer's state.
     */
    isStateEqual(other: MockPeer<T>): boolean {
        return JSON.stringify(this.state) === JSON.stringify(other.state);
    }
}

/**
 * Create a set of connected MockPeers for testing.
 */
export function createPeers<T>(
    count: number,
    initialState?: T | null
): MockPeer<T>[] {
    const peers: MockPeer<T>[] = [];
    for (let i = 0; i < count; i++) {
        peers.push(new MockPeer<T>(`peer-${i}`, initialState ?? null));
    }
    // Connect all peers to each other
    for (let i = 0; i < count; i++) {
        for (let j = i + 1; j < count; j++) {
            peers[i].connect(peers[j]);
        }
    }
    return peers;
}
