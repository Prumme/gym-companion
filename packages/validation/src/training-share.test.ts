import { describe, expect, it } from 'vitest';

import {
  isTrainingShareExpired,
  sharedProgramSnapshotV1Schema,
  sharedWorkoutTemplateSnapshotV1Schema,
  suggestProgramNameFromWorkoutTemplate,
  trainingShareSnapshotSchema,
  importTrainingShareDestinationSchema,
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
    expect(suggestProgramNameFromWorkoutTemplate('Full Body A')).toBe(
      'Programme Full Body A',
    );
    expect(suggestProgramNameFromWorkoutTemplate('Programme déjà nommé')).toBe(
      'Programme déjà nommé',
    );
  });

  it('détecte l’expiration inclusive à expiresAt', () => {
    const expiresAt = new Date('2026-08-17T14:00:00.000Z');
    expect(
      isTrainingShareExpired(expiresAt, new Date('2026-08-17T13:59:59.999Z')),
    ).toBe(false);
    expect(
      isTrainingShareExpired(expiresAt, new Date('2026-08-17T14:00:00.000Z')),
    ).toBe(true);
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
});
