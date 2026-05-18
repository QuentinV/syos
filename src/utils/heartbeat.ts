import { tick } from '../state/heartbeat';

export const startHeartbeat = () => {
    setInterval(() => {
        tick();
    }, 3000);
};
