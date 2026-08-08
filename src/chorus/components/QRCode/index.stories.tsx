import type { Meta, StoryObj } from '@storybook/react-vite';
import { createStore } from 'effector';
import { QRCode } from '.';
import { ChorusSessionContext, defaultTurnHooks } from '../../context';

const getJoinUrl = (sessionId: string, peerId: string) =>
    `https://example.com/join/${sessionId}/${peerId}`;

const $peerId = createStore<string | null>('peer-abc');

const meta = {
    title: 'chorus/components/QRCode',
    parameters: {
        layout: 'centered',
    },
    component: QRCode,
    tags: ['autodocs'],
    decorators: [
        (Story) => (
            <ChorusSessionContext.Provider
                value={{
                    ...defaultTurnHooks,
                    sessionId: 'session-123',
                    getJoinUrl,
                    $store: createStore(null),
                    $id: createStore<string | null>('session-123'),
                    $peerId,
                    events: {},
                }}
            >
                <Story />
            </ChorusSessionContext.Provider>
        ),
    ],
} satisfies Meta<typeof QRCode>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {},
};

export const CustomColors: Story = {
    args: {
        bgColor: '#1a1a1a',
        fgColor: '#f59e0b',
        title: 'Join session QRCode',
    },
};
