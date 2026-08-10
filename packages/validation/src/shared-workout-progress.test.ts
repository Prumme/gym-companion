import { describe, expect, it } from 'vitest';

import {
  buildExerciseProgressSummary,
  buildWorkoutProgressSummary,
  isExerciseFullyProcessed,
  isProcessedSetStatus,
  safeProgressRatio,
} from './shared-workout-progress';

describe('isProcessedSetStatus (Shared 5.5)', () => {
  it.each([
    ['PENDING', false],
    ['COMPLETED', true],
    ['PARTIAL', true],
    ['FAILED', true],
    ['SKIPPED', true],
    ['CANCELLED', true],
  ] as const)('%s → %s', (status, expected) => {
    expect(isProcessedSetStatus(status)).toBe(expected);
  });
});

describe('buildExerciseProgressSummary', () => {
  it('compte COMPLETED+PARTIAL+FAILED+PENDING', () => {
    const summary = buildExerciseProgressSummary({
      exerciseNameSnapshot: 'Développé',
      sets: [
        { status: 'COMPLETED' },
        { status: 'PARTIAL' },
        { status: 'FAILED' },
        { status: 'PENDING' },
      ],
    });
    expect(summary).toEqual({
      name: 'Développé',
      processedSetCount: 3,
      totalSetCount: 4,
    });
  });

  it('inclut SKIPPED et warmup (pas de distinction type)', () => {
    const summary = buildExerciseProgressSummary({
      exerciseNameSnapshot: 'Squat',
      sets: [
        { status: 'COMPLETED' },
        { status: 'SKIPPED' },
        { status: 'PENDING' },
      ],
    });
    expect(summary.processedSetCount).toBe(2);
    expect(summary.totalSetCount).toBe(3);
  });

  it('exercice sans set → 0/0', () => {
    expect(
      buildExerciseProgressSummary({
        exerciseNameSnapshot: 'Vide',
        sets: [],
      }),
    ).toEqual({ name: 'Vide', processedSetCount: 0, totalSetCount: 0 });
  });
});

describe('buildWorkoutProgressSummary', () => {
  it('agrège sets et exercices', () => {
    const summary = buildWorkoutProgressSummary([
      {
        exerciseNameSnapshot: 'A',
        sets: [
          { status: 'COMPLETED' },
          { status: 'COMPLETED' },
          { status: 'COMPLETED' },
        ],
      },
      {
        exerciseNameSnapshot: 'B',
        sets: [
          { status: 'COMPLETED' },
          { status: 'COMPLETED' },
          { status: 'PENDING' },
          { status: 'PENDING' },
        ],
      },
      {
        exerciseNameSnapshot: 'C',
        sets: [
          { status: 'PENDING' },
          { status: 'PENDING' },
          { status: 'PENDING' },
        ],
      },
    ]);
    expect(summary).toEqual({
      processedSetCount: 5,
      totalSetCount: 10,
      processedExerciseCount: 1,
      totalExerciseCount: 3,
    });
  });

  it('exercice sans set compte comme processed', () => {
    expect(isExerciseFullyProcessed({ exerciseNameSnapshot: 'X', sets: [] })).toBe(
      true,
    );
  });
});

describe('safeProgressRatio', () => {
  it('évite division par zéro', () => {
    expect(safeProgressRatio(0, 0)).toBe(0);
    expect(safeProgressRatio(3, 0)).toBe(0);
    expect(safeProgressRatio(1, 4)).toBe(0.25);
  });
});
