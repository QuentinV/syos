import type { Meta, StoryObj } from '@storybook/react-vite';
import { createStore, createEvent, createEffect } from 'effector';
import { SessionLobby } from '.';
import { ChorusSessionContext } from '../../core/context';
import { ChorusTurnContext, defaultTurnHooks } from '../../turn';
import { TurnSessionState } from '../../turn';

const getJoinUrl = (sessionId: string, peerId: string) =>
    `https://example.com/join/${sessionId}/${peerId}`;

const $peerId = createStore<string | null>('peer-abc');

const makeState = (
    participants: { id: string; name: string; ready: boolean }[]
): TurnSessionState<string, never> => ({
    id: 'session-123',
    participants: Object.fromEntries(participants.map((p) => [p.id, p])),
    turns: [],
    status: 'lobby',
    createdAt: Date.now(),
});

const renderLobby = (
    participants: { id: string; name: string; ready: boolean }[],
    localParticipantId?: string
) => {
    const $store = createStore<TurnSessionState<string, never> | null>(
        makeState(participants)
    );
    const $id = createStore<string | null>('session-123');
    const toggleParticipantReady = createEvent<string>();
    const startSession = createEvent<void>();

    const contextValue = {
        sessionId: 'session-123',
        getJoinUrl,
        joinFx: createEffect(
            (a: { objectId: string; peerId: string }): string => ''
        ),
        $store,
        $id,
        $peerId,
        events: { toggleParticipantReady, startSession },
    };

    const turnHooks = {
        ...defaultTurnHooks,
        useLocalParticipant: () =>
            localParticipantId
                ? { id: localParticipantId, name: 'You', ready: false }
                : undefined,
    };

    return (
        <ChorusSessionContext.Provider value={contextValue}>
            <ChorusTurnContext.Provider value={turnHooks}>
                <SessionLobby />
            </ChorusTurnContext.Provider>
        </ChorusSessionContext.Provider>
    );
};

const meta = {
    title: 'chorus/components/SessionLobby',
    parameters: { layout: 'padded' },
    component: SessionLobby,
    tags: ['autodocs'],
} satisfies Meta<typeof SessionLobby>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    render: () =>
        renderLobby(
            [
                { id: 'p1', name: 'Alice', ready: true },
                { id: 'p2', name: 'Bob', ready: false },
                { id: 'p3', name: 'Charlie', ready: false },
            ],
            'p1'
        ),
};

export const CanStart: Story = {
    render: () =>
        renderLobby(
            [
                { id: 'p1', name: 'Alice', ready: true },
                { id: 'p2', name: 'Bob', ready: true },
            ],
            'p1'
        ),
};

export const Observer: Story = {
    render: () =>
        renderLobby([
            { id: 'p1', name: 'Alice', ready: true },
            { id: 'p2', name: 'Bob', ready: false },
        ]),
};
