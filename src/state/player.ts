import { createParticipantStore } from '../chorus';

export const participantStore = createParticipantStore('player');

export const { $participant, setParticipantName } = participantStore;
