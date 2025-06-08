import Peer, { DataConnection } from 'peerjs';
import { v4 as uuid } from 'uuid';
import { rtcActions } from './rtc_actions';

export interface PeerGameData {
    gameId: string;
    peerId: string;
    conn?: Peer;
    peers: PeersInfos;
}

export interface PeerInfo {
    peerId: string;
    conn?: DataConnection;
}

export interface Message {
    type: string;
    data?: any;
}

type PeerData = { [gameId: string]: PeerGameData };
type PeersInfos = { [peerId: string]: PeerInfo };

const savePeerData = (data: PeerData) => {
    localStorage.setItem('peerData', JSON.stringify(data));
};

const getPeerData = () => {
    const str = localStorage.getItem('peerData');
    if (!str) {
        savePeerData({});
        return {};
    }
    return JSON.parse(str);
};

export const peerData = getPeerData();

const updatePeerGameData = ({ gameId, peerId, peers }: PeerGameData) => {
    savePeerData({
        ...getPeerData(),
        [gameId]: {
            peerId,
            gameId,
            peers: Object.keys(peers).reduce((prev, key) => {
                prev[key] = { peerId: peers[key].peerId };
                return prev;
            }, {} as PeersInfos),
        },
    });
};

export const getPeerGameData = ({
    gameId,
}: {
    gameId: string;
}): PeerGameData => {
    let peerGameData = peerData[gameId];
    if (!peerGameData) {
        const peerId = uuid();
        peerGameData = {
            gameId,
            peerId,
            peers: [],
        };
        updatePeerGameData(peerGameData);
    }
    return peerGameData;
};

export const connectToPeer = async (
    peerGameData: PeerGameData,
    peerId: string
) => {
    if (!peerGameData.conn) return;

    let pi = peerGameData.peers[peerId];
    if (pi?.conn) {
        return pi;
    }

    console.log('[ME] open connection to ', peerId);

    const conn = peerGameData.conn.connect(peerId);
    const peerInfo = { conn, peerId };
    if (!pi) {
        peerGameData.peers[peerId] = peerInfo;
        updatePeerGameData(peerGameData);
    }

    await new Promise((res) => {
        conn.on('open', () => {
            console.log(`[${peerId}] connection opened`);
            res(undefined);
        });
    });

    conn.on('data', (mess) => {
        console.log(`[${peerId}] incoming`, mess);
        callAction(mess as Message, conn);
    });

    return peerInfo;
};

const callAction = async ({ type, data }: Message, conn: DataConnection) => {
    const res = await rtcActions?.[type]?.(data);
    if (res) {
        return conn.send({ type: `${type}_answer`, data: res });
    }
};

export const initPeerConnection = async ({
    gameId,
}: {
    gameId: string;
}): Promise<PeerGameData> => {
    const data = getPeerGameData({ gameId });

    if (data.conn) {
        return data;
    }

    console.log('init peer connection');
    const peer = new Peer(data.peerId, {
        host: '0.peerjs.com',
        port: 443,
        path: '/',
    });
    data.conn = peer;

    await new Promise((res) => {
        peer.on('open', (id) => {
            console.log('[ME] opened', id);
            res(id);
        });
    });

    peer.on('connection', (conn) => {
        console.log('[ME] incoming connection', conn);

        data.peers[conn.peer] = { peerId: conn.peer, conn };

        conn.on('data', (mess) => {
            console.log(`[ME] receving data from [${conn.peer}]`, mess);
            callAction(mess as Message, conn);
        });
    });

    for (let key in data.peers) {
        const peerInfo = data.peers[key];
        data.peers[key] =
            (await connectToPeer(data, peerInfo.peerId)) ?? data.peers[key];
    }

    return data;
};

export const sendMessage = ({
    peerId,
    gameId,
    message,
}: {
    peerId: string;
    gameId: string;
    message: Message;
}) => {
    const data = getPeerGameData({ gameId });
    return data.peers[peerId]?.conn?.send(message);
};
