import type { Meta, StoryObj } from '@storybook/react-vite';
import { QRCode } from '.';
import { ChorusSessionContext } from '../../context';

const getJoinUrl = (sessionId: string, peerId: string) =>
    `https://example.com/join/${sessionId}/${peerId}`;

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
                    peerId: 'peer-abc',
                    getJoinUrl,
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
