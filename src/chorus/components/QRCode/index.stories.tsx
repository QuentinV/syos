import type { Meta, StoryObj } from '@storybook/react-vite';
import { createEffect, createStore } from 'effector';
import { QRCode } from '.';
import { ChorusSessionContext } from '../../core/context';

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
                    sessionId: 'session-123',
                    getJoinUrl,
                    joinFx: createEffect(
                        (a: { objectId: string; peerId: string }): string => ''
                    ),
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
