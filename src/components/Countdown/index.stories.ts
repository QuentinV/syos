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

export const Knob: Story = {
    args: {
        limit: 10,
        style: 'knob',
        onComplete: () => console.log('complete'),
    },
};

export const Bar: Story = {
    args: {
        limit: 10,
        style: 'bar',
        onComplete: () => console.log('complete'),
    },
};
