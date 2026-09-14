import { describe, expect, it } from 'vitest';

import { createWorkoutSessionDetail, createWorkoutSet } from './fixtures';
import {
  buildWorkoutExportDocument,
  toWorkoutExportSession,
  workoutExportFilename,
} from '../lib/workout-export';

describe('workout JSON export', () => {
  it('projette une séance sans ownerUserId ni UUID internes d’exercice', () => {
    const session = createWorkoutSessionDetail({
      name: 'Push',
      status: 'COMPLETED',
      localDate: '2026-09-14',
      notes: 'Bonne séance',
      exercises: [
        {
          id: 'se-1',
          position: 0,
          sourceExerciseId: 'ex-press',
          exerciseName: 'Développé couché',
          measurementType: 'WEIGHT_REPS',
          primaryMuscleGroupName: 'Pectoraux',
          sourceExerciseArchivedAtCreation: false,
          equipment: { id: 'eq-1', code: 'BARBELL', name: 'Barre' },
          notes: null,
          restSeconds: 120,
          sets: [
            createWorkoutSet({
              status: 'COMPLETED',
              actualWeightKg: 80,
              actualReps: 8,
              actualRir: 2,
            }),
          ],
        },
      ],
    });

    const exported = toWorkoutExportSession(session);
    expect(exported).not.toHaveProperty('id');
    expect(JSON.stringify(exported)).not.toContain('ex-press');
    expect(exported.exercises[0]?.name).toBe('Développé couché');
    expect(exported.exercises[0]?.sets[0]?.actualWeightKg).toBe(80);
    expect(exported.source.programName).toBeTruthy();

    const document = buildWorkoutExportDocument([session], '2026-09-14T10:00:00.000Z');
    expect(document.schemaVersion).toBe(1);
    expect(document.workouts).toHaveLength(1);
    expect(workoutExportFilename([session])).toBe(
      'gym-companion-seance-2026-09-14.json',
    );
  });
});
