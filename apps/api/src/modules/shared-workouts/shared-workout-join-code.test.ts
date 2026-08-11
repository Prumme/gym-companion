import { describe, expect, it } from 'vitest';

import { generateSharedWorkoutJoinCode } from './shared-workout-join-code';
import {
  SHARED_WORKOUT_JOIN_CODE_ALPHABET,
  SHARED_WORKOUT_JOIN_CODE_LENGTH,
} from '@gym-companion/validation';

describe('generateSharedWorkoutJoinCode', () => {
  it('génère un code de 6 caractères dans l’alphabet', () => {
    for (let i = 0; i < 20; i += 1) {
      const code = generateSharedWorkoutJoinCode();
      expect(code).toHaveLength(SHARED_WORKOUT_JOIN_CODE_LENGTH);
      for (const char of code) {
        expect(SHARED_WORKOUT_JOIN_CODE_ALPHABET).toContain(char);
      }
    }
  });
});
