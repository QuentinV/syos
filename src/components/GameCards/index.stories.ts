import type { Meta, StoryObj } from '@storybook/react-vite';
import { GameCards } from '.';

const meta = {
    title: 'components/GameCards',
    parameters: {
        layout: 'centered',
    },
    component: GameCards,
    tags: ['autodocs'],
} satisfies Meta<typeof GameCards>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        indexes: [1, 2, 3, 4],
    },
};

export const Selected: Story = {
    args: {
        indexes: [1, 2, 3],
        selected: [1, 2, 3],
    },
};

export const SelectedMoreRows: Story = {
    args: {
        indexes: [1, 2, 3, 4, 10],
        selected: [2, 4],
        visible: true,
    },
};

export const SelectedSmallSize: Story = {
    args: {
        indexes: [1, 2, 3],
        selected: [1, 2, 3],
        size: 'sm',
    },
};
