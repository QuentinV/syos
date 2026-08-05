import { createParticipantStore } from '../chorus';

const { $participant, setParticipantName } = createParticipantStore('player');

export { $participant, setParticipantName };
