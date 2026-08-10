import { describe, expect, it } from 'vitest';

import {
  buildProgressOverviewTimeline,
  computeAverageWorkoutsPerWeek,
  computeProgressOverviewComparison,
  computeProgressOverviewTotals,
  computeProgressTopExercises,
  countInclusiveLocalDays,
  endOfWeekSunday,
  parseProgressOverviewQuery,
  percentageChange,
  resolvePreviousRange,
  resolveProgressOverviewBucket,
  startOfWeekMonday,
  type ProgressOverviewSessionInput,
} from './progress-overview';

function set(
  overrides: Partial<
    ProgressOverviewSessionInput['exercises'][0]['sets'][0]
  > = {},
) {
  return {
    setType: 'WORKING',
    status: 'COMPLETED',
    actualWeightKg: 100,
    actualReps: 5,
    actualDurationSeconds: null,
    actualDistanceMeters: null,
    reachedFailure: false,
    ...overrides,
  };
}

function session(
  overrides: Partial<ProgressOverviewSessionInput> &
    Pick<ProgressOverviewSessionInput, 'workoutSessionId' | 'localDate'>,
): ProgressOverviewSessionInput {
  return {
    startedAt: `${overrides.localDate}T08:00:00.000Z`,
    completedAt: `${overrides.localDate}T09:00:00.000Z`,
    exercises: [
      {
        sourceExerciseId: 'ex-1',
        exerciseNameSnapshot: 'Développé',
        measurementType: 'WEIGHT_REPS',
        sets: [set()],
      },
    ],
    ...overrides,
  };
}

describe('granularité', () => {
  it('DAY / WEEK / MONTH selon la plage', () => {
    expect(resolveProgressOverviewBucket('2026-08-01', '2026-08-20')).toBe(
      'DAY',
    );
    expect(resolveProgressOverviewBucket('2026-01-01', '2026-06-01')).toBe(
      'WEEK',
    );
    expect(resolveProgressOverviewBucket('2024-01-01', '2026-08-01')).toBe(
      'MONTH',
    );
  });
});

describe('semaines lundi→dimanche', () => {
  it('traverse une année', () => {
    expect(startOfWeekMonday('2025-12-31')).toBe('2025-12-29');
    expect(endOfWeekSunday('2025-12-31')).toBe('2026-01-04');
  });
});

describe('totaux', () => {
  it('aucune séance', () => {
    const totals = computeProgressOverviewTotals([]);
    expect(totals.workoutCount).toBe(0);
    expect(totals.performedSetCount).toBe(0);
  });

  it('agrège plusieurs séances et ignore sourceExerciseId null pour uniques', () => {
    const totals = computeProgressOverviewTotals([
      session({ workoutSessionId: 'a', localDate: '2026-08-01' }),
      session({
        workoutSessionId: 'b',
        localDate: '2026-08-01',
        exercises: [
          {
            sourceExerciseId: null,
            exerciseNameSnapshot: 'Libre',
            measurementType: 'WEIGHT_REPS',
            sets: [set({ actualWeightKg: 50, actualReps: 10 })],
          },
          {
            sourceExerciseId: 'ex-1',
            exerciseNameSnapshot: 'Développé',
            measurementType: 'WEIGHT_REPS',
            sets: [set({ reachedFailure: true })],
          },
        ],
      }),
    ]);
    expect(totals.workoutCount).toBe(2);
    expect(totals.exerciseCount).toBe(3);
    expect(totals.uniqueExerciseCount).toBe(1);
    expect(totals.performedSetCount).toBe(3);
    expect(totals.workingExternalVolumeKg).toBe(1500);
    expect(totals.failureSetCount).toBe(1);
  });
});

describe('fréquence', () => {
  it('activeDayCount distinct', () => {
    const sessions = [
      session({ workoutSessionId: 'a', localDate: '2026-08-01' }),
      session({ workoutSessionId: 'b', localDate: '2026-08-01' }),
      session({ workoutSessionId: 'c', localDate: '2026-08-02' }),
    ];
    expect(new Set(sessions.map((s) => s.localDate)).size).toBe(2);
  });

  it('moyenne null si plage < 7 jours', () => {
    expect(computeAverageWorkoutsPerWeek(3, '2026-08-01', '2026-08-05')).toBeNull();
  });

  it('moyenne déterministe', () => {
    expect(countInclusiveLocalDays('2026-08-01', '2026-08-14')).toBe(14);
    expect(computeAverageWorkoutsPerWeek(4, '2026-08-01', '2026-08-14')).toBe(2);
  });
});

describe('timeline buckets', () => {
  it('remplit les buckets vides DAY', () => {
    const points = buildProgressOverviewTimeline(
      [session({ workoutSessionId: 'a', localDate: '2026-08-01' })],
      '2026-08-01',
      '2026-08-03',
      'DAY',
    );
    expect(points).toHaveLength(3);
    expect(points[0]!.workoutCount).toBe(1);
    expect(points[1]!.workoutCount).toBe(0);
    expect(points[2]!.workoutCount).toBe(0);
  });

  it('WEEK et MONTH', () => {
    const week = buildProgressOverviewTimeline(
      [session({ workoutSessionId: 'a', localDate: '2026-08-05' })],
      '2026-08-03',
      '2026-08-16',
      'WEEK',
    );
    expect(week.length).toBeGreaterThanOrEqual(2);
    expect(week[0]!.periodStart).toBe('2026-08-03');

    const month = buildProgressOverviewTimeline(
      [session({ workoutSessionId: 'a', localDate: '2026-08-10' })],
      '2026-07-15',
      '2026-09-10',
      'MONTH',
    );
    expect(month.map((p) => p.periodStart)).toEqual([
      '2026-07-01',
      '2026-08-01',
      '2026-09-01',
    ]);
    expect(month[1]!.workoutCount).toBe(1);
  });
});

describe('comparaison', () => {
  it('hausse / baisse / zéro / égalité', () => {
    expect(percentageChange(12, 10)).toBe(20);
    expect(percentageChange(8, 10)).toBe(-20);
    expect(percentageChange(10, 10)).toBe(0);
    expect(percentageChange(5, 0)).toBeNull();
  });

  it('période précédente de même durée inclusive', () => {
    // 31 jours : 1–31 mai → 31 jours se terminant la veille = 31 mars–30 avril
    expect(resolvePreviousRange('2026-05-01', '2026-05-31')).toEqual({
      from: '2026-03-31',
      to: '2026-04-30',
    });
    expect(resolvePreviousRange('2026-05-01', '2026-05-30')).toEqual({
      from: '2026-04-01',
      to: '2026-04-30',
    });
  });

  it('comparison object', () => {
    const comparison = computeProgressOverviewComparison(
      {
        workoutCount: 4,
        exerciseCount: 4,
        uniqueExerciseCount: 2,
        performedSetCount: 20,
        totalReps: 100,
        workingExternalVolumeKg: 2000,
        totalDurationSeconds: 0,
        totalDistanceMeters: 0,
        failureSetCount: 0,
      },
      {
        workoutCount: 2,
        exerciseCount: 2,
        uniqueExerciseCount: 1,
        performedSetCount: 10,
        totalReps: 50,
        workingExternalVolumeKg: 1000,
        totalDurationSeconds: 0,
        totalDistanceMeters: 0,
        failureSetCount: 0,
      },
    );
    expect(comparison.workoutCountChangePercent).toBe(100);
    expect(comparison.workingExternalVolumeChangePercent).toBe(100);
  });
});

describe('top exercices', () => {
  it('trie et exclut sourceExerciseId null', () => {
    const top = computeProgressTopExercises(
      [
        session({ workoutSessionId: 'a', localDate: '2026-08-01' }),
        session({
          workoutSessionId: 'b',
          localDate: '2026-08-02',
          exercises: [
            {
              sourceExerciseId: null,
              exerciseNameSnapshot: 'Orphelin',
              measurementType: 'WEIGHT_REPS',
              sets: [set()],
            },
            {
              sourceExerciseId: 'ex-2',
              exerciseNameSnapshot: 'Squat',
              measurementType: 'WEIGHT_REPS',
              sets: [set(), set()],
            },
          ],
        }),
        session({
          workoutSessionId: 'c',
          localDate: '2026-08-03',
          exercises: [
            {
              sourceExerciseId: 'ex-2',
              exerciseNameSnapshot: 'Squat renommé',
              measurementType: 'WEIGHT_REPS',
              sets: [set()],
            },
          ],
        }),
      ],
      5,
    );
    expect(top[0]!.exerciseId).toBe('ex-2');
    expect(top[0]!.workoutCount).toBe(2);
    expect(top[0]!.exerciseName).toBe('Squat renommé');
    expect(top.find((item) => item.exerciseName === 'Orphelin')).toBeUndefined();
  });
});

describe('parseProgressOverviewQuery', () => {
  it('valide et rejette', () => {
    expect(parseProgressOverviewQuery({ metric: 'WORKOUT_COUNT' }).ok).toBe(
      true,
    );
    const badRange = parseProgressOverviewQuery({
      from: '2026-08-01',
      to: '2026-01-01',
    });
    expect(badRange.ok).toBe(false);
    if (!badRange.ok) {
      expect(badRange.code).toBe('PROGRESS_INVALID_DATE_RANGE');
    }
    const badMetric = parseProgressOverviewQuery({ metric: 'EPLEY' });
    expect(badMetric.ok).toBe(false);
  });
});
