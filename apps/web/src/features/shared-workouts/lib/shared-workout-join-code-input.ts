import {
  SHARED_WORKOUT_JOIN_CODE_ALPHABET,
  SHARED_WORKOUT_JOIN_CODE_LENGTH,
  formatSharedWorkoutJoinCode,
} from '@gym-companion/validation';

const ALPHABET_SET = new Set(SHARED_WORKOUT_JOIN_CODE_ALPHABET.split(''));

/** Normalise une saisie partielle (sans lever d’erreur). */
export function sanitizePartialSharedWorkoutJoinCode(raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/[\s-]+/g, '');
  let result = '';
  for (const char of cleaned) {
    if (ALPHABET_SET.has(char) && result.length < SHARED_WORKOUT_JOIN_CODE_LENGTH) {
      result += char;
    }
  }
  return result;
}

export function displaySharedWorkoutJoinCode(normalized: string): string {
  if (normalized.length === 0) return '';
  if (normalized.length <= 3) return normalized;
  if (normalized.length === SHARED_WORKOUT_JOIN_CODE_LENGTH) {
    return formatSharedWorkoutJoinCode(normalized);
  }
  return `${normalized.slice(0, 3)}-${normalized.slice(3)}`;
}

export function isCompleteSharedWorkoutJoinCode(normalized: string): boolean {
  return normalized.length === SHARED_WORKOUT_JOIN_CODE_LENGTH;
}
