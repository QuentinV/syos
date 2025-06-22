import type { Meta, StoryObj } from '@storybook/react-vite';
import { Countdown } from '.';

const meta = {
    title: 'components/Countdown',
    parameters: {
        layout: 'centered',
    },
    component: Countdown,
    tags: ['autodocs'],
} satisfies Meta<typeof Countdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        limit: 10,
        onComplete: () => console.log('complete'),
    },
};
