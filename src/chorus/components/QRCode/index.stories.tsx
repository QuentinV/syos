import type { Meta, StoryObj } from '@storybook/react-vite';
import { QRCode } from '.';

const meta = {
    title: 'chorus/components/QRCode',
    parameters: {
        layout: 'centered',
    },
    component: QRCode,
    tags: ['autodocs'],
} satisfies Meta<typeof QRCode>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        value: 'https://example.com/join/session-123',
    },
};

export const CustomColors: Story = {
    args: {
        value: 'https://example.com/join/session-123',
        bgColor: '#1a1a1a',
        fgColor: '#f59e0b',
        title: 'Join session QRCode',
    },
};
