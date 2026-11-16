import { describe, expect, it } from 'vitest';

import {
  isTrainingShareExpired,
  sharedProgramSnapshotV1Schema,
  sharedWorkoutTemplateSnapshotV1Schema,
  suggestProgramNameFromWorkoutTemplate,
  trainingShareSnapshotSchema,
  importTrainingShareDestinationSchema,
  sharedTemplateExerciseSchema,
} from './training-share';

describe('training-share schemas', () => {
  const set = {
    setType: 'WORKING' as const,
    targetRepMin: 8,
    targetRepMax: 12,
    targetDurationSeconds: null,
    targetDistanceMeters: null,
    targetWeightKg: null,
    targetIntensityPercent: null,
    targetRir: 2,
    targetRpe: null,
    restSeconds: 90,
  };

  const exerciseId = '11111111-1111-1111-1111-111111111111';

  it('accepte un snapshot programme V1', () => {
    const parsed = sharedProgramSnapshotV1Schema.parse({
      version: 1,
      kind: 'PROGRAM',
      name: 'Débutant',
      description: null,
      goal: 'HYPERTROPHY',
      workouts: [
        {
          name: 'Full Body A',
          description: null,
          estimatedDurationMinutes: 45,
          exercises: [
            {
              exerciseId,
              equipmentTypeId: null,
              notes: null,
              restSecondsOverride: null,
              sets: [set],
            },
          ],
        },
      ],
    });
    expect(parsed.workouts).toHaveLength(1);
  });

  it('accepte un snapshot séance V1', () => {
    const parsed = sharedWorkoutTemplateSnapshotV1Schema.parse({
      version: 1,
      kind: 'WORKOUT_TEMPLATE',
      name: 'Full Body A',
      description: null,
      estimatedDurationMinutes: 45,
      exercises: [],
    });
    expect(parsed.kind).toBe('WORKOUT_TEMPLATE');
  });

  it('refuse une version inconnue', () => {
    expect(() =>
      trainingShareSnapshotSchema.parse({
        version: 99,
        kind: 'PROGRAM',
        name: 'X',
        description: null,
        goal: 'STRENGTH',
        workouts: [
          {
            name: 'A',
            description: null,
            estimatedDurationMinutes: null,
            exercises: [],
          },
        ],
      }),
    ).toThrow();
  });

  it('suggère un nom de programme depuis une séance', () => {
    expect(suggestProgramNameFromWorkoutTemplate('Full Body A')).toBe('Programme Full Body A');
    expect(suggestProgramNameFromWorkoutTemplate('Programme déjà nommé')).toBe(
      'Programme déjà nommé',
    );
  });

  it('détecte l’expiration inclusive à expiresAt', () => {
    const expiresAt = new Date('2026-08-17T14:00:00.000Z');
    expect(isTrainingShareExpired(expiresAt, new Date('2026-08-17T13:59:59.999Z'))).toBe(false);
    expect(isTrainingShareExpired(expiresAt, new Date('2026-08-17T14:00:00.000Z'))).toBe(true);
  });

  it('valide les destinations d’import', () => {
    expect(
      importTrainingShareDestinationSchema.parse({
        type: 'NEW_PROGRAM',
        programName: 'Programme Full Body A',
      }).type,
    ).toBe('NEW_PROGRAM');
    expect(
      importTrainingShareDestinationSchema.parse({
        type: 'EXISTING_PROGRAM',
        programId: exerciseId,
      }).type,
    ).toBe('EXISTING_PROGRAM');
  });

  describe('exercices personnels', () => {
    const muscleId = '22222222-2222-2222-2222-222222222222';
    const definition = {
      key: 'p1',
      name: 'Tapis course/marche',
      measurementType: 'DURATION' as const,
      category: 'CARDIO' as const,
      cardioType: 'TREADMILL' as const,
      primaryMuscleGroupId: muscleId,
      secondaryMuscleGroupIds: [],
      defaultEquipmentTypeId: null,
      compatibleEquipmentTypes: [],
      defaultRestSeconds: null,
      instructions: null,
    };
    const personalExercise = {
      exerciseId: null,
      personalExerciseKey: 'p1',
      equipmentTypeId: null,
      notes: null,
      restSecondsOverride: null,
      sets: [],
    };
    const workout = (exercises: unknown[]) => ({
      version: 1,
      kind: 'WORKOUT_TEMPLATE',
      name: 'Cardio',
      description: null,
      estimatedDurationMinutes: 30,
      exercises,
    });

    it('accepte un snapshot d’exercice', () => {
      const parsed = trainingShareSnapshotSchema.parse({
        version: 1,
        kind: 'EXERCISE',
        exercise: definition,
      });
      expect(parsed.kind).toBe('EXERCISE');
    });

    it('accepte un ancien snapshot sans personalExercises', () => {
      const parsed = trainingShareSnapshotSchema.parse(
        workout([
          {
            exerciseId,
            equipmentTypeId: null,
            notes: null,
            restSecondsOverride: null,
            sets: [set],
          },
        ]),
      );
      expect(parsed.kind).toBe('WORKOUT_TEMPLATE');
    });

    it('accepte une séance qui référence un exercice personnel décrit', () => {
      const parsed = trainingShareSnapshotSchema.parse({
        ...workout([personalExercise]),
        personalExercises: [definition],
      });
      expect(parsed.kind).toBe('WORKOUT_TEMPLATE');
    });

    it('exige exactement une référence par exercice', () => {
      expect(() =>
        sharedTemplateExerciseSchema.parse({
          ...personalExercise,
          exerciseId,
        }),
      ).toThrow();
      expect(() =>
        sharedTemplateExerciseSchema.parse({
          ...personalExercise,
          personalExerciseKey: null,
        }),
      ).toThrow();
    });

    it('refuse une clé non décrite, en double ou inutilisée', () => {
      expect(() => trainingShareSnapshotSchema.parse(workout([personalExercise]))).toThrow();
      expect(() =>
        trainingShareSnapshotSchema.parse({
          ...workout([personalExercise]),
          personalExercises: [definition, definition],
        }),
      ).toThrow();
      expect(() =>
        trainingShareSnapshotSchema.parse({
          ...workout([]),
          personalExercises: [definition],
        }),
      ).toThrow();
    });
  });
});
