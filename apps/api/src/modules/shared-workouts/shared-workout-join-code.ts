import { randomInt } from 'node:crypto';

import {
  SHARED_WORKOUT_JOIN_CODE_ALPHABET,
  SHARED_WORKOUT_JOIN_CODE_LENGTH,
} from '@gym-companion/validation';

/** Génère un code normalisé (6 chars) via crypto.randomInt — API only. */
export function generateSharedWorkoutJoinCode(): string {
  let code = '';
  for (let i = 0; i < SHARED_WORKOUT_JOIN_CODE_LENGTH; i += 1) {
    const index = randomInt(0, SHARED_WORKOUT_JOIN_CODE_ALPHABET.length);
    code += SHARED_WORKOUT_JOIN_CODE_ALPHABET[index]!;
  }
  return code;
}
