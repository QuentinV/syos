import { computeTurnSessionChecksum } from '../chorus';
import { Game } from './types';

export const computeGameChecksum = (state: Game | null): string =>
    computeTurnSessionChecksum(state);
