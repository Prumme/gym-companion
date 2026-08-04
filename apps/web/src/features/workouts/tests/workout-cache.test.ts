import { describe, expect, it } from 'vitest';

import { applyUpdateWorkoutSetResult } from '../lib/workout-cache';
import { createWorkoutSessionDetail, createWorkoutSet } from './fixtures';

describe('workout-cache', () => {
  it('remplace la série ciblée et met à jour la version sans toucher aux autres', () => {
    const session = createWorkoutSessionDetail({
      version: 1,
      exercises: [
        {
          id: 'wse-1',
          position: 0,
          sourceExerciseId: 'ex-1',
          exerciseName: 'Développé couché',
          measurementType: 'WEIGHT_REPS',
          primaryMuscleGroupName: 'Pectoraux',
          sourceExerciseArchivedAtCreation: false,
          equipment: { id: 'eq-1', code: 'barbell', name: 'Barre' },
          notes: null,
          restSeconds: 90,
          sets: [
            createWorkoutSet({ id: 'ws-1', status: 'PENDING' }),
            createWorkoutSet({
              id: 'ws-2',
              position: 1,
              status: 'PENDING',
              targetWeightKg: 70,
            }),
          ],
        },
      ],
    });

    const updated = applyUpdateWorkoutSetResult(session, {
      workoutSet: createWorkoutSet({
        id: 'ws-1',
        status: 'COMPLETED',
        actualWeightKg: 60,
        actualReps: 10,
        completedAt: '2026-08-04T10:05:00.000Z',
      }),
      workoutSessionVersion: 2,
    });

    expect(updated.version).toBe(2);
    const sets = updated.exercises[0]?.sets ?? [];
    expect(sets[0]?.status).toBe('COMPLETED');
    expect(sets[0]?.actualReps).toBe(10);
    expect(sets[1]?.status).toBe('PENDING');
    expect(sets[1]?.targetWeightKg).toBe(70);
  });
});
