import type { Meta, StoryObj } from '@storybook/react-vite';
import { PlayersBoard } from '.';
import { fork } from 'effector';
import { GameProvider, $game, $gameId, $peerId } from '../../state/game';
import { Provider } from 'effector-react';
import { PlayerRole } from '../../state/types';

const meta = {
    title: 'components/PlayersBoard',
    parameters: {
        layout: 'centered',
    },
    component: PlayersBoard,
    tags: ['autodocs'],
    decorators: [
        (Story, context) => {
            const { parameters } = context;
            const scope = fork({
                values: [
                    [
                        $game,
                        {
                            id: '123',
                            turns: [
                                {
                                    status: 'stPicksCards',
                                    participants: {
                                        '123': {
                                            playerId: '123',
                                            role: PlayerRole.storyteller,
                                            score: 456,
                                        },
                                        '456': {
                                            playerId: '456',
                                            role: PlayerRole.gremlin,
                                            score: 789,
                                        },
                                    },
                                },
                            ],
                            participants: {
                                '123': { name: 'P 123' },
                                '456': { name: 'P 456 ', ready: true },
                            },
                            createdAt: new Date(),
                            status: 'running',
                        },
                    ],
                    [$peerId, 'PEER ID'],
                    [$gameId, '123'],
                ],
            });
            return (
                <Provider value={scope}>
                    <GameProvider>
                        <Story />
                    </GameProvider>
                </Provider>
            );
        },
    ],
} satisfies Meta<typeof PlayersBoard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {},
};
