import type { Meta, StoryObj } from '@storybook/react-vite';
import { SessionLobby } from '.';

const meta = {
    title: 'chorus/components/SessionLobby',
    parameters: {
        layout: 'padded',
    },
    component: SessionLobby,
    tags: ['autodocs'],
} satisfies Meta<typeof SessionLobby>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        sessionId: 'session-123',
        peerId: 'peer-abc',
        players: [
            { id: 'p1', name: 'Alice', ready: true },
            { id: 'p2', name: 'Bob', ready: false },
            { id: 'p3', name: 'Charlie', ready: false },
        ],
        currentPlayerId: 'p1',
        joinUrl: 'https://example.com/join/session-123/peer-abc',
        onToggleReady: (id) => console.log('toggle ready', id),
        onStart: () => console.log('start'),
        canStart: false,
    },
};

export const CanStart: Story = {
    args: {
        sessionId: 'session-123',
        peerId: 'peer-abc',
        players: [
            { id: 'p1', name: 'Alice', ready: true },
            { id: 'p2', name: 'Bob', ready: true },
        ],
        currentPlayerId: 'p1',
        joinUrl: 'https://example.com/join/session-123/peer-abc',
        onToggleReady: (id) => console.log('toggle ready', id),
        onStart: () => console.log('start'),
        canStart: true,
    },
};

export const Observer: Story = {
    args: {
        sessionId: 'session-123',
        peerId: 'peer-abc',
        players: [
            { id: 'p1', name: 'Alice', ready: true },
            { id: 'p2', name: 'Bob', ready: false },
        ],
        joinUrl: 'https://example.com/join/session-123/peer-abc',
        onToggleReady: (id) => console.log('toggle ready', id),
        onStart: () => console.log('start'),
        canStart: false,
    },
};
