import type { Meta, StoryObj } from '@storybook/react-vite';
import { DebugPanel } from '.';
import { createEffect, createStore, fork } from 'effector';
import { Provider } from 'effector-react';
import { debug } from '../../debug/debug';
import { ChorusSessionContext } from '../../core/context';
import { DebugMessage, JoinFxType } from '../../core/types';

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
            participants: { abc: { id: 'abc', name: 'Alice', ready: false } },
            turns: [],
            createdAt: Date.now(),
        },
    },
    {
        id: 'msg-2',
        direction: 'out',
        timestamp: Date.now() - 3000,
        type: 'event',
        eventName: 'toggleParticipantReady',
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
    title: 'chorus/components/DebugPanel',
    parameters: {
        layout: 'fullscreen',
    },
    component: DebugPanel,
    tags: ['autodocs'],
    decorators: [
        (Story, context) => {
            const { parameters } = context;
            const $peerId = createStore<string | null>('my-peer-id-xyz');
            const scope = fork({
                values: [
                    [debug.$panelOpen, parameters.open ?? false],
                    [debug.$clock, 3],
                    [
                        debug.$checksum,
                        'game-123|running|stPicksCards:2|abc:1,def:1',
                    ],
                    [debug.$messages, parameters.messages ?? sampleMessages],
                ],
            });
            return (
                <Provider value={scope}>
                    <ChorusSessionContext.Provider
                        value={{
                            sessionId: 'game-123',
                            getJoinUrl: (sessionId, peerId) =>
                                `/game/${sessionId}/join/${peerId}`,
                            checksum: (state: any) =>
                                `game-123|running|stPicksCards:2|abc:1,def:1`,
                            joinFx: createEffect(
                                (a: {
                                    objectId: string;
                                    peerId: string;
                                }): string => ''
                            ),
                            $store: createStore(null),
                            $id: createStore<string | null>('game-123'),
                            $peerId,
                            events: {},
                        }}
                    >
                        <Story />
                    </ChorusSessionContext.Provider>
                </Provider>
            );
        },
    ],
} satisfies Meta<typeof DebugPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
    args: {
        state: { id: 'game-123', status: 'running' },
    },
    parameters: { open: false },
};

export const Open: Story = {
    args: {
        state: { id: 'game-123', status: 'running' },
    },
    parameters: { open: true },
};

export const EmptyMessages: Story = {
    args: {
        state: { id: 'game-123', status: 'running' },
    },
    parameters: { open: true, messages: [] },
};
