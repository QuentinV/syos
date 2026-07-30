import React, { useEffect, useRef, useState } from 'react';
import { useUnit } from 'effector-react';
import { Button } from 'primereact/button';
import { TabView, TabPanel } from 'primereact/tabview';
import { Badge } from 'primereact/badge';
import {
    $debugMessages,
    $debugPanelOpen,
    $debugClock,
    $debugChecksum,
    toggleDebugPanel,
    setDebugPanelOpen,
    clearDebugMessages,
    DebugMessage,
} from '../../state/debug';
import { $game, $peerId } from '../../state/game';
import { computeGameChecksum } from '../../state/checksum';
import './styles.css';

const formatTime = (timestamp: number): string => {
    const d = new Date(timestamp);
    return (
        d.toLocaleTimeString('en-US', { hour12: false }) +
        '.' +
        String(d.getMilliseconds()).padStart(3, '0')
    );
};

const truncateId = (id: string | undefined, len = 12): string => {
    if (!id) return '-';
    return id.length > len ? id.slice(0, len) + '…' : id;
};

const safeStringify = (obj: any): string => {
    try {
        return JSON.stringify(obj, null, 2);
    } catch {
        return String(obj);
    }
};

const DebugMessageRow: React.FC<{
    message: DebugMessage;
    expanded: boolean;
    onToggle: () => void;
}> = ({ message, expanded, onToggle }) => {
    const name = message.eventName ?? message.action ?? 'unknown';

    return (
        <div
            className={`debugMessageItem ${expanded ? 'expanded' : ''}`}
            onClick={onToggle}
        >
            <div className="debugMessageHeader">
                <span className={`debugMessageDirection ${message.direction}`}>
                    {message.direction === 'in' ? '←' : '→'}
                </span>
                <span className={`debugMessageBadge ${message.type}`}>
                    {message.type}
                </span>
                <span className="debugMessageName">{name}</span>
            </div>
            <div className="debugMessageMeta">
                {message.clock !== undefined && (
                    <span>
                        <span className="label">clock:</span>
                        {message.clock}
                    </span>
                )}
                <span>
                    <span className="label">peer:</span>
                    {truncateId(message.peerId)}
                </span>
                <span>
                    <span className="label">time:</span>
                    {formatTime(message.timestamp)}
                </span>
                {message.checksum && (
                    <span>
                        <span className="label">checksum:</span>
                        {truncateId(message.checksum, 16)}
                    </span>
                )}
            </div>
            {expanded && message.payload !== undefined && (
                <div className="debugMessagePayload">
                    {safeStringify(message.payload)}
                </div>
            )}
        </div>
    );
};

const StateTab: React.FC = () => {
    const game = useUnit($game);
    const peerId = useUnit($peerId);
    const clock = useUnit($debugClock);
    const checksum = useUnit($debugChecksum);
    const liveChecksum = game ? computeGameChecksum(game) : 'null';

    return (
        <div>
            <div className="debugStateSection">
                <div className="debugStateLabel">Peer ID</div>
                <div className="debugStateValue">
                    {peerId ?? 'not connected'}
                </div>
            </div>
            <div className="debugStateSection">
                <div className="debugStateLabel">Lamport Clock</div>
                <div className="debugStateValue">{clock}</div>
            </div>
            <div className="debugStateSection">
                <div className="debugStateLabel">Last Message Checksum</div>
                <div className="debugStateValue">{checksum || 'none'}</div>
            </div>
            <div className="debugStateSection">
                <div className="debugStateLabel">Live State Checksum</div>
                <div className="debugStateValue">{liveChecksum}</div>
            </div>
            <div className="debugStateSection">
                <div className="debugStateLabel">Game State</div>
                <div className="debugStateJson">{safeStringify(game)}</div>
            </div>
        </div>
    );
};

const MessagesTab: React.FC = () => {
    const messages = useUnit($debugMessages);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to top when new messages arrive (DESC order — newest first)
    useEffect(() => {
        if (listRef.current) {
            listRef.current.scrollTop = 0;
        }
    }, [messages]);

    if (messages.length === 0) {
        return (
            <div className="debugEmptyState">
                <i className="pi pi-inbox" />
                <div>No messages yet</div>
                <div style={{ fontSize: '0.7rem', marginTop: '0.5rem' }}>
                    P2P messages will appear here in real time
                </div>
            </div>
        );
    }

    return (
        <div>
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    marginBottom: '0.75rem',
                }}
            >
                <Button
                    label="Clear"
                    icon="pi pi-trash"
                    className="p-button-text p-button-sm debugClearButton"
                    onClick={() => {
                        clearDebugMessages();
                        setExpandedId(null);
                    }}
                />
            </div>
            <div className="debugMessageList" ref={listRef}>
                {[...messages].reverse().map((msg) => (
                    <DebugMessageRow
                        key={msg.id}
                        message={msg}
                        expanded={expandedId === msg.id}
                        onToggle={() =>
                            setExpandedId(expandedId === msg.id ? null : msg.id)
                        }
                    />
                ))}
            </div>
        </div>
    );
};

export const DebugPanel: React.FC = () => {
    const isOpen = useUnit($debugPanelOpen);
    const messages = useUnit($debugMessages);
    const messageCount = messages.length;

    return (
        <>
            {/* Toggle button — always visible */}
            <Button
                className="debugPanelToggle p-button-warning"
                icon="pi pi-bug"
                onClick={() => toggleDebugPanel()}
                aria-label="Toggle debug panel"
            >
                {messageCount > 0 && (
                    <Badge
                        value={messageCount > 99 ? '99+' : messageCount}
                        severity="danger"
                    />
                )}
            </Button>

            {/* Overlay backdrop */}
            {isOpen && (
                <div
                    className="debugOverlay visible"
                    onClick={() => setDebugPanelOpen(false)}
                />
            )}

            {/* Sidebar panel */}
            <div className={`debugPanelSidebar ${isOpen ? 'open' : ''}`}>
                <div className="debugPanelHeader">
                    <div className="debugPanelTitle">
                        <i className="pi pi-bug" />
                        <span>Debug Panel</span>
                    </div>
                    <button
                        className="debugPanelClose"
                        onClick={() => setDebugPanelOpen(false)}
                        aria-label="Close debug panel"
                    >
                        <i className="pi pi-times" />
                    </button>
                </div>
                <div className="debugPanelContent">
                    <TabView>
                        <TabPanel header="State" leftIcon="pi pi-database">
                            <StateTab />
                        </TabPanel>
                        <TabPanel
                            header={`Messages${
                                messageCount > 0 ? ` (${messageCount})` : ''
                            }`}
                            leftIcon="pi pi-list"
                        >
                            <MessagesTab />
                        </TabPanel>
                    </TabView>
                </div>
            </div>
        </>
    );
};
