import type { Meta, StoryObj } from '@storybook/react-vite';
import { SessionLobby } from '.';
import { ChorusSessionContext } from '../../context';

const getJoinUrl = (sessionId: string, peerId: string) =>
    `https://example.com/join/${sessionId}/${peerId}`;

const meta = {
    title: 'chorus/components/SessionLobby',
    parameters: {
        layout: 'padded',
    },
    component: SessionLobby,
    tags: ['autodocs'],
    decorators: [
        (Story) => (
            <ChorusSessionContext.Provider
                value={{
                    sessionId: 'session-123',
                    peerId: 'peer-abc',
                    getJoinUrl,
                }}
            >
                <Story />
            </ChorusSessionContext.Provider>
        ),
    ],
} satisfies Meta<typeof SessionLobby>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        participants: [
            { id: 'p1', name: 'Alice', ready: true },
            { id: 'p2', name: 'Bob', ready: false },
            { id: 'p3', name: 'Charlie', ready: false },
        ],
        currentParticipantId: 'p1',
        onToggleReady: (id) => console.log('toggle ready', id),
        onStart: () => console.log('start'),
        canStart: false,
    },
};

export const CanStart: Story = {
    args: {
        participants: [
            { id: 'p1', name: 'Alice', ready: true },
            { id: 'p2', name: 'Bob', ready: true },
        ],
        currentParticipantId: 'p1',
        onToggleReady: (id) => console.log('toggle ready', id),
        onStart: () => console.log('start'),
        canStart: true,
    },
};

export const Observer: Story = {
    args: {
        participants: [
            { id: 'p1', name: 'Alice', ready: true },
            { id: 'p2', name: 'Bob', ready: false },
        ],
        onToggleReady: (id) => console.log('toggle ready', id),
        onStart: () => console.log('start'),
        canStart: false,
    },
};
