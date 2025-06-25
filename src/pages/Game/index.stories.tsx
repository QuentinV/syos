import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { GamePage, GamePageProps } from '.';
import { fork } from 'effector';
import { $game, $peerId } from '../../state/game';
import { Provider } from 'effector-react';
import { GameStatus, GameTurnStatus, PlayerRole } from '../../state/types';
import { $player } from '../../state/player';

interface GamePageWrapperProps extends GamePageProps {
    id: string;
    status: GameStatus;
    playerRole?: PlayerRole;
    turnStatus?: GameTurnStatus;
    selectedCards?: number[];
    displayedCards?: number[];
    story?: string;
    score?: number;
    estimateSelectTime?: number;
    displayedCardsTime?: Date;
    selectedCardsTime?: Date;
    speeds?: { [key: string]: number };
}

const GamePageWrapper: React.FC<GamePageWrapperProps> = ({
    id,
    status,
    playerRole = 'storyteller',
    turnStatus = 'stPicksCards',
    selectedCards,
    displayedCards,
    story,
    score,
    estimateSelectTime,
    displayedCardsTime,
    selectedCardsTime,
    speeds,
}) => {
    const scope = fork({
        values: [
            [
                $game,
                {
                    id,
                    turns: [
                        {
                            status: turnStatus,
                            players: {
                                '123': {
                                    playerId: '123',
                                    role: playerRole,
                                    score: score,
                                    selectedCards,
                                    displayedCards,
                                    story,
                                    displayedCardsTime:
                                        displayedCardsTime?.getTime(),
                                    selectedCardsTime:
                                        selectedCardsTime?.getTime(),
                                    speed: speeds?.['123'],
                                },
                                '456': {
                                    playerId: '456',
                                    role:
                                        playerRole === PlayerRole.storyteller
                                            ? PlayerRole.gremlin
                                            : PlayerRole.storyteller,
                                    score: 789,
                                    estimateSelectTime,
                                    selectedCards,
                                    displayedCards,
                                    speed: speeds?.['456'],
                                },
                            },
                        },
                    ],
                    players: {
                        '123': { name: 'P 123' },
                        '456': { name: 'P 456 ', ready: true },
                    },
                    createdAt: new Date(),
                    status,
                },
            ],
            [$player, { id: '123', name: 'P123' }],
            [$peerId, 'PEER ID'],
        ],
    });
    return (
        <Provider value={scope}>
            <GamePage id={id} init={false} />
        </Provider>
    );
};

const meta = {
    title: 'pages/GamePage',
    component: GamePageWrapper,
    tags: ['autodocs'],
    argTypes: {
        playerRole: {
            options: Object.values(PlayerRole),
            control: { type: 'radio' },
        },
        turnStatus: {
            options: [
                'stPicksCards',
                'stWriteStory',
                'pEstimate',
                'pPicksCards',
                'turnEnded',
            ],
            control: { type: 'radio' },
        },
    },
} satisfies Meta<typeof GamePageWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Lobby: Story = {
    args: {
        id: '123',
        status: 'lobby',
    },
};

export const End: Story = {
    args: {
        id: '123',
        status: 'finished',
    },
};

export const StorytellerPickCards: Story = {
    args: {
        id: '123',
        status: 'running',
        turnStatus: 'stPicksCards',
        playerRole: PlayerRole.storyteller,
        selectedCards: [],
        displayedCards: [5, 6, 7, 8, 9, 10, 11, 12, 13],
        story: '',
        score: 10300,
    },
};

export const StorytellerWriteStory: Story = {
    args: {
        id: '123',
        status: 'running',
        turnStatus: 'stWriteStory',
        playerRole: PlayerRole.storyteller,
        selectedCards: [7, 12, 13],
        displayedCards: [5, 6, 7, 8, 9, 10, 11, 12, 13],
        story: '',
        score: 10300,
    },
};

export const PlayerEstimate: Story = {
    args: {
        id: '123',
        status: 'running',
        turnStatus: 'stWriteStory',
        playerRole: PlayerRole.gremlin,
        selectedCards: [7, 12, 13],
        displayedCards: [5, 6, 7, 8, 9, 10, 11, 12, 13],
        story: '',
        score: 10300,
    },
};

export const StorytellerPlayerPickCards: Story = {
    args: {
        id: '123',
        status: 'running',
        turnStatus: 'pPicksCards',
        playerRole: PlayerRole.storyteller,
        selectedCards: [7, 12, 13],
        displayedCards: [5, 6, 7, 8, 9, 10, 11, 12, 13],
        story: 'this is my story',
        score: 10300,
        speeds: { 456: 0.4 },
    },
};

export const PlayerPickCards: Story = {
    args: {
        id: '123',
        status: 'running',
        turnStatus: 'pPicksCards',
        playerRole: PlayerRole.gremlin,
        displayedCards: [5, 6, 7, 8, 9, 10, 11, 12, 13],
        story: 'this is my story',
        score: 10300,
    },
};

export const PlayerCardsPicked: Story = {
    args: {
        id: '123',
        status: 'running',
        turnStatus: 'pPicksCards',
        playerRole: PlayerRole.storyteller,
        selectedCards: [7, 12, 13],
        displayedCards: [5, 6, 7, 8, 9, 10, 11, 12, 13],
        story: 'this is my story',
        score: 10300,
        speeds: { 456: 0.6 },
    },
};

export const TurnEnded: Story = {
    args: {
        id: '123',
        status: 'running',
        turnStatus: 'turnEnded',
        playerRole: PlayerRole.storyteller,
        selectedCards: [],
        displayedCards: [5, 6, 7, 8, 9, 10, 11, 12, 13],
        story: '',
        score: 10300,
    },
};
