import type { Meta, StoryObj } from '@storybook/react-vite';
import { GameCard } from '.';

const meta = {
    title: 'components/GameCard',
    parameters: {
        layout: 'centered',
    },
    component: GameCard,
    tags: ['autodocs'],
} satisfies Meta<typeof GameCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        index: 10,
    },
};

export const Visible: Story = {
    args: {
        index: 10,
        visible: true,
    },
};
