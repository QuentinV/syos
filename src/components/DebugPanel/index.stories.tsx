import type { Meta, StoryObj } from '@storybook/react-vite';
import { DebugPanel } from '.';
import { fork } from 'effector';
import { Provider } from 'effector-react';
import {
    $debugMessages,
    $debugPanelOpen,
    $debugClock,
    $debugChecksum,
} from '../../state/debug';
import { $game, $peerId } from '../../state/game';
import { PlayerRole } from '../../state/types';
import { DebugMessage } from '../../state/debug';

const sampleMessages: DebugMessage[] = [
    {
        id: 'msg-1',
        direction: 'in',
        timestamp: Date.now() - 5000,
        type: 'event',
        eventName: 'setState',
        clock: 1,
        peerId: 'peer-abc123def456',
        checksum: 'game-id|lobby|0|abc:0,def:1',
        payload: {
            id: 'game-123',
            status: 'lobby',
            players: { abc: { id: 'abc', name: 'Alice', ready: false } },
            turns: [],
            createdAt: Date.now(),
        },
    },
    {
        id: 'msg-2',
        direction: 'out',
        timestamp: Date.now() - 3000,
        type: 'event',
        eventName: 'togglePlayerReady',
        clock: 2,
        peerId: 'my-peer-id',
        checksum: 'game-id|lobby|0|abc:1',
        payload: { playerId: 'abc' },
    },
    {
        id: 'msg-3',
        direction: 'in',
        timestamp: Date.now() - 1000,
        type: 'control',
        action: 'ping',
        peerId: 'peer-abc123def456',
    },
    {
        id: 'msg-4',
        direction: 'out',
        timestamp: Date.now() - 500,
        type: 'event',
        eventName: 'startGame',
        clock: 3,
        peerId: 'my-peer-id',
        checksum: 'game-id|running|0|abc:1,def:1',
        payload: undefined,
    },
];

const meta = {
    title: 'components/DebugPanel',
    parameters: {
        layout: 'fullscreen',
    },
    component: DebugPanel,
    tags: ['autodocs'],
    decorators: [
        (Story, context) => {
            const { parameters } = context;
            const scope = fork({
                values: [
                    [
                        $game,
                        {
                            id: 'game-123',
                            turns: [
                                {
                                    status: 'stPicksCards',
                                    players: {
                                        abc: {
                                            playerId: 'abc',
                                            role: PlayerRole.storyteller,
                                            score: 0,
                                        },
                                        def: {
                                            playerId: 'def',
                                            role: PlayerRole.gremlin,
                                            score: 0,
                                        },
                                    },
                                },
                            ],
                            players: {
                                abc: {
                                    id: 'abc',
                                    name: 'Alice',
                                    ready: true,
                                },
                                def: {
                                    id: 'def',
                                    name: 'Bob',
                                    ready: true,
                                },
                            },
                            createdAt: Date.now(),
                            status: 'running',
                        },
                    ],
                    [$peerId, 'my-peer-id-xyz'],
                    [$debugPanelOpen, parameters.open ?? false],
                    [$debugClock, 3],
                    [
                        $debugChecksum,
                        'game-123|running|stPicksCards:2|abc:1,def:1',
                    ],
                    [$debugMessages, parameters.messages ?? sampleMessages],
                ],
            });
            return (
                <Provider value={scope}>
                    <Story />
                </Provider>
            );
        },
    ],
} satisfies Meta<typeof DebugPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
    args: {},
    parameters: { open: false },
};

export const Open: Story = {
    args: {},
    parameters: { open: true },
};

export const EmptyMessages: Story = {
    args: {},
    parameters: { open: true, messages: [] },
};
