import { describe, expect, it } from 'vitest';

import {
  formatRemainingShareTime,
  formatShareSetsLine,
} from '../lib/share-format';

describe('share-format', () => {
  it('formate les séries homogènes', () => {
    expect(
      formatShareSetsLine([
        {
          setType: 'WORKING',
          targetRepMin: 8,
          targetRepMax: 12,
          targetDurationSeconds: null,
          targetDistanceMeters: null,
          targetWeightKg: null,
          restSeconds: 90,
        },
        {
          setType: 'WORKING',
          targetRepMin: 8,
          targetRepMax: 12,
          targetDurationSeconds: null,
          targetDistanceMeters: null,
          targetWeightKg: null,
          restSeconds: 90,
        },
        {
          setType: 'WORKING',
          targetRepMin: 8,
          targetRepMax: 12,
          targetDurationSeconds: null,
          targetDistanceMeters: null,
          targetWeightKg: null,
          restSeconds: 90,
        },
      ]),
    ).toBe('3 × 8–12');
  });

  it('calcule le temps restant', () => {
    const expiresAt = new Date('2026-08-17T15:00:00.000Z').toISOString();
    expect(
      formatRemainingShareTime(
        expiresAt,
        new Date('2026-08-17T14:18:00.000Z').getTime(),
      ),
    ).toBe('42 min');
  });
});
