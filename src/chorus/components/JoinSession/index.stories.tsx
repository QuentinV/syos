import type { Meta, StoryObj } from '@storybook/react-vite';
import { JoinSession } from '.';

const meta = {
    title: 'chorus/components/JoinSession',
    parameters: {
        layout: 'centered',
    },
    component: JoinSession,
    tags: ['autodocs'],
} satisfies Meta<typeof JoinSession>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        sessionId: 'session-123',
        peerId: 'peer-abc',
        participantName: 'Alice',
    },
};
