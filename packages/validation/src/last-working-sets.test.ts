import { describe, expect, it } from 'vitest';

import {
  LAST_WORKING_SETS_MAX_EXERCISE_IDS,
  parseLastWorkingSetsQuery,
} from './last-working-sets';

const idA = '11111111-1111-4111-8111-111111111111';
const idB = '22222222-2222-4222-8222-222222222222';

describe('parseLastWorkingSetsQuery', () => {
  it('accepte une liste CSV d’UUIDs et déduplique', () => {
    const result = parseLastWorkingSetsQuery({
      exerciseIds: `${idA},${idB},${idA}`,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.exerciseIds).toEqual([idA, idB]);
    }
  });

  it('refuse un UUID invalide', () => {
    const result = parseLastWorkingSetsQuery({
      exerciseIds: 'not-a-uuid',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('PROGRESS_INVALID_EXERCISE_IDS');
    }
  });

  it('refuse une liste vide', () => {
    const result = parseLastWorkingSetsQuery({ exerciseIds: '' });
    expect(result.ok).toBe(false);
  });

  it('refuse trop d’identifiants', () => {
    const ids = Array.from(
      { length: LAST_WORKING_SETS_MAX_EXERCISE_IDS + 1 },
      (_, index) =>
        `11111111-1111-4111-8111-${String(index).padStart(12, '0')}`,
    );
    const result = parseLastWorkingSetsQuery({
      exerciseIds: ids.join(','),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('PROGRESS_INVALID_EXERCISE_IDS');
    }
  });
});
