import React, { useEffect, useRef, useState } from 'react';
import { useUnit } from 'effector-react';
import { debug } from '../../debug/debug';
import { useChorusSession } from '../../core/context';
import { DebugMessage } from '../../core/types';
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

type MessageTypeFilter = 'all' | 'control' | 'event';

const filterOptions = [
    { label: 'all', value: 'all' },
    { label: 'control', value: 'control' },
    { label: 'event', value: 'event' },
];

const DebugMessageRow: React.FC<{
    message: DebugMessage;
    expanded: boolean;
    onToggle: () => void;
}> = ({ message, expanded, onToggle }) => {
    const name = message.eventName ?? message.action ?? 'unknown';

    return (
        <div
            className={`chorus-debug-message-item ${expanded ? 'expanded' : ''}`}
            onClick={onToggle}
        >
            <div className="chorus-debug-message-header">
                <span
                    className={`chorus-debug-message-direction ${message.direction}`}
                >
                    {message.direction === 'in' ? '←' : '→'}
                </span>
                <span className={`chorus-debug-message-badge ${message.type}`}>
                    {message.type}
                </span>
                <span className="chorus-debug-message-name">{name}</span>
            </div>
            <div className="chorus-debug-message-meta">
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
                <div className="chorus-debug-message-payload">
                    {safeStringify(message.payload)}
                </div>
            )}
        </div>
    );
};

export interface DebugPanelProps {
    state?: any;
}

const StateTab: React.FC<DebugPanelProps> = ({ state }) => {
    const clock = useUnit(debug.$clock);
    const checksum = useUnit(debug.$checksum);
    const { checksum: computeChecksum, $peerId } = useChorusSession();
    const peerId = useUnit($peerId);
    const liveChecksum =
        state && computeChecksum ? computeChecksum(state) : undefined;

    return (
        <div>
            <div className="chorus-debug-state-section">
                <div className="chorus-debug-state-label">Peer ID</div>
                <div className="chorus-debug-state-value">
                    {peerId ?? 'not connected'}
                </div>
            </div>
            <div className="chorus-debug-state-section">
                <div className="chorus-debug-state-label">Lamport Clock</div>
                <div className="chorus-debug-state-value">{clock}</div>
            </div>
            <div className="chorus-debug-state-section">
                <div className="chorus-debug-state-label">
                    Last Message Checksum
                </div>
                <div className="chorus-debug-state-value">
                    {checksum || 'none'}
                </div>
            </div>
            <div className="chorus-debug-state-section">
                <div className="chorus-debug-state-label">
                    Live State Checksum
                </div>
                <div className="chorus-debug-state-value">
                    {liveChecksum ?? 'none'}
                </div>
            </div>
            <div className="chorus-debug-state-section">
                <div className="chorus-debug-state-label">State</div>
                <div className="chorus-debug-state-json">
                    {safeStringify(state)}
                </div>
            </div>
        </div>
    );
};

const MessagesTab: React.FC = () => {
    const messages = useUnit(debug.$messages);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [typeFilter, setTypeFilter] = useState<MessageTypeFilter>('all');
    const listRef = useRef<HTMLDivElement>(null);

    const filteredMessages =
        typeFilter === 'all'
            ? messages
            : messages.filter((msg) => msg.type === typeFilter);

    // Auto-scroll to top when new messages arrive (DESC order — newest first)
    useEffect(() => {
        if (listRef.current) {
            listRef.current.scrollTop = 0;
        }
    }, [messages]);

    if (filteredMessages.length === 0) {
        return (
            <div className="chorus-debug-empty-state">
                <div className="chorus-debug-empty-icon">📭</div>
                <div>No messages yet</div>
                <div className="chorus-debug-empty-hint">
                    {typeFilter !== 'all'
                        ? `No ${typeFilter} messages to display`
                        : 'P2P messages will appear here in real time'}
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="chorus-debug-filter-toolbar">
                <div className="chorus-debug-type-filter">
                    {filterOptions.map((opt) => (
                        <button
                            key={opt.value}
                            className={`chorus-debug-filter-btn ${
                                typeFilter === opt.value ? 'active' : ''
                            }`}
                            onClick={() =>
                                setTypeFilter(opt.value as MessageTypeFilter)
                            }
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
                <button
                    className="chorus-debug-clear-btn"
                    onClick={() => {
                        debug.clear();
                        setExpandedId(null);
                    }}
                >
                    Clear
                </button>
            </div>
            <div className="chorus-debug-message-list" ref={listRef}>
                {[...filteredMessages].reverse().map((msg) => (
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

export const DebugPanel: React.FC<DebugPanelProps> = (props) => {
    const isOpen = useUnit(debug.$panelOpen);
    const messages = useUnit(debug.$messages);
    const messageCount = messages.length;
    const [activeTab, setActiveTab] = useState<'state' | 'messages'>('state');

    return (
        <>
            {/* Toggle button — always visible */}
            <button
                className="chorus-debug-panel-toggle"
                onClick={() => debug.togglePanel()}
                aria-label="Toggle debug panel"
            >
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <circle cx="9" cy="7" r="3" />
                    <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    <path d="M21 21v-2a4 4 0 0 0-3-3.87" />
                </svg>
                {messageCount > 0 && (
                    <span className="chorus-debug-badge">
                        {messageCount > 99 ? '99+' : messageCount}
                    </span>
                )}
            </button>

            {/* Overlay backdrop */}
            {isOpen && (
                <div
                    className="chorus-debug-overlay visible"
                    onClick={() => debug.setPanelOpen(false)}
                />
            )}

            {/* Sidebar panel */}
            <div
                className={`chorus-debug-panel-sidebar ${isOpen ? 'open' : ''}`}
            >
                <div className="chorus-debug-panel-header">
                    <div className="chorus-debug-panel-title">
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <circle cx="9" cy="7" r="3" />
                            <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            <path d="M21 21v-2a4 4 0 0 0-3-3.87" />
                        </svg>
                        <span>Debug Panel</span>
                    </div>
                    <button
                        className="chorus-debug-panel-close"
                        onClick={() => debug.setPanelOpen(false)}
                        aria-label="Close debug panel"
                    >
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
                <div className="chorus-debug-panel-tabs">
                    <button
                        className={`chorus-debug-tab ${
                            activeTab === 'state' ? 'active' : ''
                        }`}
                        onClick={() => setActiveTab('state')}
                    >
                        State
                    </button>
                    <button
                        className={`chorus-debug-tab ${
                            activeTab === 'messages' ? 'active' : ''
                        }`}
                        onClick={() => setActiveTab('messages')}
                    >
                        Messages{messageCount > 0 ? ` (${messageCount})` : ''}
                    </button>
                </div>
                <div className="chorus-debug-panel-content">
                    {activeTab === 'state' ? (
                        <StateTab {...props} />
                    ) : (
                        <MessagesTab />
                    )}
                </div>
            </div>
        </>
    );
};
