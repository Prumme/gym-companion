import { describe, expect, it } from 'vitest';

import {
  computeElapsedDurationMs,
  formatElapsedDuration,
} from '../lib/workout-elapsed-duration';
import {
  buildWorkoutHistorySearchParamsFromFilters,
  countActiveWorkoutHistoryFilters,
  parseWorkoutHistorySearchParams,
  resolveHistoryBackPath,
  toWorkoutHistoryApiFilters,
} from '../lib/workout-history-filters';

describe('workout-elapsed-duration', () => {
  it('calcule la durée écoulée pour COMPLETED et CANCELLED', () => {
    expect(
      computeElapsedDurationMs({
        startedAt: '2026-08-04T10:00:00.000Z',
        completedAt: '2026-08-04T11:30:00.000Z',
        cancelledAt: null,
        status: 'COMPLETED',
      }),
    ).toBe(90 * 60_000);

    expect(
      computeElapsedDurationMs({
        startedAt: '2026-08-04T10:00:00.000Z',
        completedAt: null,
        cancelledAt: '2026-08-04T10:15:00.000Z',
        status: 'CANCELLED',
      }),
    ).toBe(15 * 60_000);

    expect(
      computeElapsedDurationMs({
        startedAt: '2026-08-04T10:00:00.000Z',
        completedAt: null,
        cancelledAt: null,
        status: 'COMPLETED',
      }),
    ).toBeNull();
  });

  it('formate la durée', () => {
    expect(formatElapsedDuration(90 * 60_000)).toBe('1 h 30 min');
    expect(formatElapsedDuration(45 * 60_000)).toBe('45 min');
  });
});

describe('workout-history-filters', () => {
  it('parse et sérialise les filtres URL', () => {
    const parsed = parseWorkoutHistorySearchParams(
      new URLSearchParams('status=COMPLETED&from=2026-07-01&to=2026-08-04'),
    );
    expect(parsed).toEqual({
      status: 'COMPLETED',
      from: '2026-07-01',
      to: '2026-08-04',
    });
    expect(toWorkoutHistoryApiFilters(parsed)).toEqual({
      status: 'COMPLETED',
      from: '2026-07-01',
      to: '2026-08-04',
    });
    expect(countActiveWorkoutHistoryFilters(parsed)).toBe(3);
    expect(
      buildWorkoutHistorySearchParamsFromFilters({ status: 'ALL' }).toString(),
    ).toBe('');
  });

  it('ignore un statut ou une date invalide', () => {
    expect(
      parseWorkoutHistorySearchParams(
        new URLSearchParams('status=ACTIVE&from=nope'),
      ),
    ).toEqual({ status: 'ALL', from: undefined, to: undefined });
  });

  it('résout le retour historique', () => {
    expect(
      resolveHistoryBackPath({
        fromHistory: true,
        historySearch: '?status=CANCELLED',
      }),
    ).toBe('/workouts?status=CANCELLED');
    expect(resolveHistoryBackPath(null)).toBe('/workouts');
  });
});
