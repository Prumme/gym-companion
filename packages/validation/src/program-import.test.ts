import { describe, expect, it } from 'vitest';

import {
  PROGRAM_IMPORT_MAX_EXERCISES_PER_WORKOUT,
  PROGRAM_IMPORT_MAX_SETS_PER_EXERCISE,
  PROGRAM_IMPORT_MAX_WORKOUTS,
  formatSystemExerciseCatalogLine,
  parseProgramImportPayload,
  programImportPayloadV1Schema,
  suggestExerciseSlugs,
  validateProgramImportSetForMeasurement,
  findDuplicateExerciseSlugsInWorkout,
} from './program-import';

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    program: {
      name: 'Push Pull Legs',
      description: 'Programme 3 séances.',
      goal: 'HYPERTROPHY',
      workouts: [
        {
          name: 'Push',
          description: null,
          estimatedDurationMinutes: 60,
          exercises: [
            {
              exerciseSlug: 'developpe-couche-barre',
              notes: null,
              sets: [
                { repsMin: 8, repsMax: 10, rir: 2, restSeconds: 120 },
                { repsMin: 8, repsMax: 10, rir: 2, restSeconds: 120 },
              ],
            },
          ],
        },
      ],
    },
    ...overrides,
  };
}

describe('program-import V1 schema', () => {
  it('accepte un programme WEIGHT_REPS simple', () => {
    const parsed = parseProgramImportPayload(validPayload());
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.schemaVersion).toBe(1);
      expect(parsed.data.program.workouts).toHaveLength(1);
    }
  });

  it('accepte plusieurs séances et séries distinctes', () => {
    const parsed = parseProgramImportPayload({
      schemaVersion: 1,
      program: {
        name: 'PPL',
        description: null,
        goal: 'STRENGTH',
        workouts: [
          {
            name: 'A',
            description: null,
            estimatedDurationMinutes: 45,
            exercises: [
              {
                exerciseSlug: 'squat-barre',
                sets: [
                  { repsMin: 5, repsMax: 5, rpe: 8, restSeconds: 180 },
                  { repsMin: 3, repsMax: 5, rir: 1, restSeconds: 180 },
                ],
              },
            ],
          },
          {
            name: 'B',
            description: null,
            estimatedDurationMinutes: 60,
            exercises: [
              {
                exerciseSlug: 'developpe-couche-barre',
                sets: [{ repsMin: 6, repsMax: 8, restSeconds: 150 }],
              },
            ],
          },
        ],
      },
    });
    expect(parsed.ok).toBe(true);
  });

  it('refuse une schemaVersion inconnue avec un message explicite', () => {
    const parsed = parseProgramImportPayload({
      ...validPayload(),
      schemaVersion: 2,
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors[0]).toMatchObject({
        path: 'schemaVersion',
        code: 'UNSUPPORTED_SCHEMA_VERSION',
        message: "Version d'import non supportée : 2. Version supportée : 1.",
      });
    }
  });

  it('refuse une propriété inconnue (strict)', () => {
    const parsed = parseProgramImportPayload({
      ...validPayload(),
      ownerUserId: 'should-not-pass',
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors.some((item) => item.code === 'UNKNOWN_FIELD')).toBe(
        true,
      );
    }
  });

  it('refuse un goal inventé', () => {
    const raw = validPayload();
    (raw.program as { goal: string }).goal = 'BODYBUILDING_POWER_HYPERTROPHY';
    const parsed = parseProgramImportPayload(raw);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors[0]?.code).toBe('INVALID_ENUM');
      expect(parsed.errors[0]?.path).toBe('program.goal');
    }
  });

  it('refuse un champ obligatoire absent', () => {
    const parsed = parseProgramImportPayload({
      schemaVersion: 1,
      program: {
        description: null,
        goal: 'HYPERTROPHY',
        workouts: [
          {
            name: 'Push',
            estimatedDurationMinutes: 60,
            exercises: [
              {
                exerciseSlug: 'developpe-couche-barre',
                sets: [{ repsMin: 8, repsMax: 10 }],
              },
            ],
          },
        ],
      },
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors.some((item) => item.path === 'program.name')).toBe(
        true,
      );
    }
  });

  it('refuse trop de séances', () => {
    const workouts = Array.from({ length: PROGRAM_IMPORT_MAX_WORKOUTS + 1 }, (_, i) => ({
      name: `S${i + 1}`,
      description: null,
      estimatedDurationMinutes: 45,
      exercises: [
        {
          exerciseSlug: 'pompes',
          sets: [{ repsMin: 8, repsMax: 12 }],
        },
      ],
    }));
    const parsed = parseProgramImportPayload({
      schemaVersion: 1,
      program: {
        name: 'Trop',
        description: null,
        goal: 'ENDURANCE',
        workouts,
      },
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors[0]?.code).toBe('LIMIT_EXCEEDED');
      expect(parsed.errors[0]?.path).toBe('program.workouts');
    }
  });

  it('refuse trop d’exercices', () => {
    const exercises = Array.from(
      { length: PROGRAM_IMPORT_MAX_EXERCISES_PER_WORKOUT + 1 },
      (_, i) => ({
        exerciseSlug: `exo-${i + 1}`,
        sets: [{ repsMin: 8, repsMax: 10 }],
      }),
    );
    const parsed = parseProgramImportPayload({
      schemaVersion: 1,
      program: {
        name: 'Trop',
        description: null,
        goal: 'HYPERTROPHY',
        workouts: [
          {
            name: 'Push',
            description: null,
            estimatedDurationMinutes: 90,
            exercises,
          },
        ],
      },
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors[0]?.code).toBe('LIMIT_EXCEEDED');
    }
  });

  it('refuse trop de séries', () => {
    const sets = Array.from(
      { length: PROGRAM_IMPORT_MAX_SETS_PER_EXERCISE + 1 },
      () => ({ repsMin: 8, repsMax: 10 }),
    );
    const parsed = parseProgramImportPayload({
      schemaVersion: 1,
      program: {
        name: 'Trop',
        description: null,
        goal: 'HYPERTROPHY',
        workouts: [
          {
            name: 'Push',
            description: null,
            estimatedDurationMinutes: 60,
            exercises: [{ exerciseSlug: 'pompes', sets }],
          },
        ],
      },
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors[0]?.code).toBe('LIMIT_EXCEEDED');
    }
  });

  it('refuse un RIR hors limites', () => {
    const parsed = parseProgramImportPayload({
      schemaVersion: 1,
      program: {
        name: 'P',
        description: null,
        goal: 'HYPERTROPHY',
        workouts: [
          {
            name: 'A',
            description: null,
            estimatedDurationMinutes: 45,
            exercises: [
              {
                exerciseSlug: 'pompes',
                sets: [{ repsMin: 8, repsMax: 10, rir: 15 }],
              },
            ],
          },
        ],
      },
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors[0]?.path).toContain('rir');
      expect(parsed.errors[0]?.code).toBe('LIMIT_EXCEEDED');
    }
  });
});

describe('program-import measurement rules', () => {
  it('accepte une série DURATION valide', () => {
    const errors = validateProgramImportSetForMeasurement(
      'DURATION',
      { durationSeconds: 45, restSeconds: 60 },
      'program.workouts[0].exercises[0].sets[0]',
    );
    expect(errors).toEqual([]);
  });

  it('refuse des reps sur un exercice DURATION', () => {
    const errors = validateProgramImportSetForMeasurement(
      'DURATION',
      { repsMin: 10, repsMax: 10 },
      'program.workouts[2].exercises[1].sets[0]',
    );
    expect(errors.some((item) => item.code === 'INCOMPATIBLE_MEASUREMENT')).toBe(
      true,
    );
    expect(errors.some((item) => item.path.endsWith('repsMin'))).toBe(true);
    expect(
      errors.some((item) =>
        item.message.includes("n'est pas compatible avec un exercice DURATION"),
      ),
    ).toBe(true);
  });

  it('accepte DISTANCE_DURATION avec distance', () => {
    const errors = validateProgramImportSetForMeasurement(
      'DISTANCE_DURATION',
      { distanceMeters: 40, durationSeconds: 60, restSeconds: 90 },
      's',
    );
    expect(errors).toEqual([]);
  });

  it('refuse repsMin > repsMax sans inversion', () => {
    const errors = validateProgramImportSetForMeasurement(
      'WEIGHT_REPS',
      { repsMin: 12, repsMax: 8, restSeconds: 90 },
      'program.workouts[1].exercises[0].sets[1]',
    );
    expect(errors[0]).toMatchObject({
      path: 'program.workouts[1].exercises[0].sets[1].repsMin',
      code: 'INVALID_TARGETS',
      message: '12 ne peut pas être supérieur à repsMax 8.',
    });
  });

  it('refuse RIR et RPE simultanés', () => {
    const errors = validateProgramImportSetForMeasurement(
      'WEIGHT_REPS',
      { repsMin: 8, repsMax: 10, rir: 2, rpe: 8 },
      's',
    );
    expect(errors.some((item) => item.code === 'CONFLICTING_INTENSITY')).toBe(
      true,
    );
  });

  it('refuse weightKg sur BODYWEIGHT_REPS', () => {
    const errors = validateProgramImportSetForMeasurement(
      'BODYWEIGHT_REPS',
      { repsMin: 8, repsMax: 12, weightKg: 20 },
      's',
    );
    expect(errors.some((item) => item.path.endsWith('weightKg'))).toBe(true);
  });
});

describe('program-import duplicates and suggestions', () => {
  it('détecte un exerciseSlug dupliqué dans une séance', () => {
    const errors = findDuplicateExerciseSlugsInWorkout('program.workouts[0]', [
      {
        exerciseSlug: 'pompes',
        sets: [{ repsMin: 8, repsMax: 10 }],
      },
      {
        exerciseSlug: 'pompes',
        sets: [{ repsMin: 8, repsMax: 10 }],
      },
    ]);
    expect(errors[0]?.code).toBe('DUPLICATE_EXERCISE_IN_WORKOUT');
    expect(errors[0]?.path).toBe('program.workouts[0].exercises[1].exerciseSlug');
  });

  it('suggère des slugs proches sans fuzzy-search externe', () => {
    const suggestions = suggestExerciseSlugs('chest-press-machin', [
      'chest-press-machine',
      'developpe-couche-barre',
      'pompes',
    ]);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions).toContain('chest-press-machine');
  });

  it('formate une ligne de catalogue compacte', () => {
    expect(
      formatSystemExerciseCatalogLine({
        slug: 'developpe-couche-barre',
        name: 'Développé couché à la barre',
        primaryMuscleCode: 'chest',
        defaultEquipmentCode: 'barbell',
        measurementType: 'WEIGHT_REPS',
      }),
    ).toBe(
      'developpe-couche-barre | Développé couché à la barre | chest | barbell | WEIGHT_REPS',
    );
  });

  it('le schema Zod refuse aussi les clés inconnues dans une série', () => {
    expect(() =>
      programImportPayloadV1Schema.parse({
        schemaVersion: 1,
        program: {
          name: 'P',
          description: null,
          goal: 'HYPERTROPHY',
          workouts: [
            {
              name: 'A',
              description: null,
              estimatedDurationMinutes: 40,
              exercises: [
                {
                  exerciseSlug: 'pompes',
                  sets: [
                    {
                      repsMin: 8,
                      repsMax: 10,
                      setType: 'WARMUP',
                    },
                  ],
                },
              ],
            },
          ],
        },
      }),
    ).toThrow();
  });
});
