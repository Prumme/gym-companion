import { describe, expect, it } from 'vitest';

import {
  addWorkoutTemplateExerciseSchema,
  buildExerciseCursorFilter,
  compactOrderedPositions,
  compactWorkoutTemplatePositions,
  computeNextOrderedPosition,
  computeNextWorkoutTemplatePosition,
  createExerciseSchema,
  createProgramSchema,
  createWorkoutTemplateSchema,
  createWorkoutTemplateSetSchema,
  decodeExerciseCursor,
  encodeExerciseCursor,
  isDefaultExercisePreferenceInput,
  listExercisesQuerySchema,
  normalizeExerciseName,
  parseApiEnv,
  profileFormSchema,
  reorderWorkoutTemplatesSchema,
  toUpdateProfilePayload,
  updateExercisePreferenceSchema,
  validateWorkoutTemplateReorder,
  validateWorkoutTemplateSetTargets,
} from './index';

const validEnv = {
  NODE_ENV: 'development',
  PORT: '3000',
  PUBLIC_APP_URL: 'http://localhost:5173',
  API_BASE_URL: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://gym:gym@localhost:5432/gym_companion',
  CORS_ALLOWED_ORIGINS: 'http://localhost:5173, http://127.0.0.1:5173',
  LOG_LEVEL: 'debug',
  JWT_ACCESS_SECRET: 'change-me-to-a-long-random-secret-at-least-32-chars',
  COOKIE_SECRET: 'change-me-cookie-secret-at-least-32-chars',
};

describe('parseApiEnv', () => {
  it('parses valid environment variables', () => {
    const env = parseApiEnv(validEnv);

    expect(env.PORT).toBe(3000);
    expect(env.CORS_ALLOWED_ORIGINS).toEqual([
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ]);
  });

  it('throws without leaking secret values when required fields are missing', () => {
    expect(() =>
      parseApiEnv({
        JWT_ACCESS_SECRET: 'super-secret-value-that-must-not-leak',
      }),
    ).toThrow(/Invalid API environment variables/);

    try {
      parseApiEnv({
        JWT_ACCESS_SECRET: 'super-secret-value-that-must-not-leak',
      });
    } catch (error) {
      expect(String(error)).not.toContain('super-secret-value-that-must-not-leak');
    }
  });
});

describe('profileFormSchema', () => {
  const validProfile = {
    displayName: 'Aurélien',
    timezone: 'Europe/Paris',
    weightUnit: 'KG' as const,
    distanceUnit: 'KM' as const,
    primaryGoal: 'STRENGTH' as const,
    experienceLevel: 'INTERMEDIATE' as const,
    effortTrackingMode: 'RIR' as const,
  };

  it('accepts a valid profile form', () => {
    const parsed = profileFormSchema.parse(validProfile);
    expect(parsed.displayName).toBe('Aurélien');
    expect(parsed.primaryGoal).toBe('STRENGTH');
  });

  it('rejects an empty display name', () => {
    const result = profileFormSchema.safeParse({
      ...validProfile,
      displayName: '   ',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.displayName?.[0]).toMatch(/requis/i);
    }
  });

  it('normalizes empty optional numeric fields to null in the payload', () => {
    const payload = toUpdateProfilePayload(
      profileFormSchema.parse({
        ...validProfile,
        heightCm: '',
        currentWeightKg: '78.5',
      }),
    );

    expect(payload.heightCm).toBeNull();
    expect(payload.currentWeightKg).toBe(78.5);
  });

  it('maps form values to an update payload', () => {
    const payload = toUpdateProfilePayload(
      profileFormSchema.parse({
        ...validProfile,
        heightCm: '180',
        currentWeightKg: '',
      }),
    );

    expect(payload).toMatchObject({
      displayName: 'Aurélien',
      heightCm: 180,
      currentWeightKg: null,
      primaryGoal: 'STRENGTH',
    });
  });
});

describe('normalizeExerciseName', () => {
  it('trims, collapses spaces, lowercases and strips accents', () => {
    expect(normalizeExerciseName('  Développé   Couché ')).toBe('developpe couche');
  });

  it('normalizes search variants to the same key', () => {
    expect(normalizeExerciseName('developpe couche')).toBe('developpe couche');
    expect(normalizeExerciseName('Développé couché')).toBe('developpe couche');
    expect(normalizeExerciseName('  DÉVELOPPÉ   COUCHÉ')).toBe('developpe couche');
  });
});

describe('listExercisesQuerySchema', () => {
  it('parses includeArchived=true', () => {
    expect(listExercisesQuerySchema.parse({ includeArchived: 'true' }).includeArchived).toBe(
      true,
    );
  });

  it('parses includeArchived=false', () => {
    expect(listExercisesQuerySchema.parse({ includeArchived: 'false' }).includeArchived).toBe(
      false,
    );
  });

  it('defaults includeArchived to false when absent', () => {
    expect(listExercisesQuerySchema.parse({}).includeArchived).toBe(false);
  });

  it('rejects an ambiguous boolean', () => {
    const result = listExercisesQuerySchema.safeParse({ includeArchived: 'maybe' });
    expect(result.success).toBe(false);
  });

  it('defaults limit to 20', () => {
    expect(listExercisesQuerySchema.parse({}).limit).toBe(20);
  });

  it('accepts limit minimum 1', () => {
    expect(listExercisesQuerySchema.parse({ limit: '1' }).limit).toBe(1);
  });

  it('accepts limit maximum 100', () => {
    expect(listExercisesQuerySchema.parse({ limit: '100' }).limit).toBe(100);
  });

  it('rejects limit below minimum', () => {
    expect(listExercisesQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
  });

  it('rejects non-integer limit', () => {
    expect(listExercisesQuerySchema.safeParse({ limit: 'abc' }).success).toBe(false);
  });

  it('rejects limit above maximum', () => {
    expect(listExercisesQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
  });

  it('rejects invalid measurementType', () => {
    expect(
      listExercisesQuerySchema.safeParse({ measurementType: 'NOT_A_TYPE' }).success,
    ).toBe(false);
  });

  it('rejects invalid source', () => {
    expect(listExercisesQuerySchema.safeParse({ source: 'COMMUNITY' }).success).toBe(false);
  });

  it('normalizes search and treats empty as absent', () => {
    expect(listExercisesQuerySchema.parse({ search: '  Développé   Couché ' }).search).toBe(
      'developpe couche',
    );
    expect(listExercisesQuerySchema.parse({ search: '   ' }).search).toBeUndefined();
  });
});

describe('exercise cursor', () => {
  it('encodes and decodes a cursor', () => {
    const payload = {
      version: 1 as const,
      normalizedName: 'developpe couche',
      id: '11111111-1111-1111-1111-111111111111',
    };
    const encoded = encodeExerciseCursor(payload);
    expect(encoded).not.toContain('{');
    expect(decodeExerciseCursor(encoded)).toEqual(payload);
  });

  it('rejects a malformed cursor', () => {
    expect(() => decodeExerciseCursor('not-a-cursor')).toThrow('EXERCISE_INVALID_CURSOR');
  });

  it('rejects an unknown cursor version', () => {
    const encoded = Buffer.from(
      JSON.stringify({
        version: 99,
        normalizedName: 'x',
        id: '11111111-1111-1111-1111-111111111111',
      }),
      'utf8',
    ).toString('base64url');
    expect(() => decodeExerciseCursor(encoded)).toThrow('EXERCISE_INVALID_CURSOR');
  });

  it('builds a stable pagination filter', () => {
    expect(
      buildExerciseCursorFilter({
        version: 1,
        normalizedName: 'curl',
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      }),
    ).toEqual({
      OR: [
        { normalizedName: { gt: 'curl' } },
        {
          AND: [
            { normalizedName: 'curl' },
            { id: { gt: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' } },
          ],
        },
      ],
    });
  });
});

describe('updateExercisePreferenceSchema', () => {
  const valid = {
    isFavorite: true,
    isExcludedFromSuggestions: false,
    preferredEquipmentTypeId: '33333333-3333-3333-3333-333333333333',
    restSecondsOverride: 90,
  };

  it('accepts a valid preference payload', () => {
    expect(updateExercisePreferenceSchema.parse(valid)).toEqual(valid);
  });

  it('rejects negative rest seconds', () => {
    expect(
      updateExercisePreferenceSchema.safeParse({
        ...valid,
        restSecondsOverride: -1,
      }).success,
    ).toBe(false);
  });

  it('rejects rest seconds above maximum', () => {
    expect(
      updateExercisePreferenceSchema.safeParse({
        ...valid,
        restSecondsOverride: 1801,
      }).success,
    ).toBe(false);
  });

  it('normalizes empty preferred equipment id to null', () => {
    expect(
      updateExercisePreferenceSchema.parse({
        ...valid,
        preferredEquipmentTypeId: '',
      }).preferredEquipmentTypeId,
    ).toBeNull();
  });

  it('rejects non-boolean favorites', () => {
    expect(
      updateExercisePreferenceSchema.safeParse({
        ...valid,
        isFavorite: 'true',
      }).success,
    ).toBe(false);
  });

  it('detects default preference input for empty-row cleanup', () => {
    expect(
      isDefaultExercisePreferenceInput({
        isFavorite: false,
        isExcludedFromSuggestions: false,
        preferredEquipmentTypeId: null,
        restSecondsOverride: null,
      }),
    ).toBe(true);
    expect(isDefaultExercisePreferenceInput(valid)).toBe(false);
  });

  it('parses favoriteOnly like includeArchived', () => {
    expect(listExercisesQuerySchema.parse({ favoriteOnly: 'true' }).favoriteOnly).toBe(
      true,
    );
    expect(listExercisesQuerySchema.parse({ favoriteOnly: 'false' }).favoriteOnly).toBe(
      false,
    );
  });
});

describe('createExerciseSchema', () => {
  const primary = '11111111-1111-1111-1111-111111111111';
  const secondary = '22222222-2222-2222-2222-222222222222';
  const equipment = '33333333-3333-3333-3333-333333333333';

  const valid = {
    name: 'Curl personnalisé',
    primaryMuscleGroupId: primary,
    secondaryMuscleGroupIds: [secondary],
    measurementType: 'WEIGHT_REPS' as const,
    defaultEquipmentTypeId: equipment,
    compatibleEquipmentTypes: [
      { equipmentTypeId: equipment, isPreferred: true, notes: null },
    ],
    defaultRestSeconds: 60,
    instructions: null,
  };

  it('accepts a valid payload', () => {
    expect(createExerciseSchema.parse(valid).name).toBe('Curl personnalisé');
  });

  it('rejects primary muscle repeated as secondary', () => {
    const result = createExerciseSchema.safeParse({
      ...valid,
      secondaryMuscleGroupIds: [primary],
    });
    expect(result.success).toBe(false);
  });

  it('rejects duplicate secondary muscles', () => {
    const result = createExerciseSchema.safeParse({
      ...valid,
      secondaryMuscleGroupIds: [secondary, secondary],
    });
    expect(result.success).toBe(false);
  });

  it('rejects duplicate compatible equipment', () => {
    const result = createExerciseSchema.safeParse({
      ...valid,
      compatibleEquipmentTypes: [
        { equipmentTypeId: equipment, isPreferred: true, notes: null },
        { equipmentTypeId: equipment, isPreferred: false, notes: null },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects default equipment not in compatible list', () => {
    const result = createExerciseSchema.safeParse({
      ...valid,
      defaultEquipmentTypeId: '44444444-4444-4444-4444-444444444444',
    });
    expect(result.success).toBe(false);
  });
});

describe('createProgramSchema', () => {
  it('parses a valid program and normalizes empty description', () => {
    const parsed = createProgramSchema.parse({
      name: '  Force  ',
      description: '   ',
      goal: 'STRENGTH',
    });
    expect(parsed.name).toBe('Force');
    expect(parsed.description).toBeNull();
    expect(parsed.goal).toBe('STRENGTH');
  });

  it('rejects missing name', () => {
    const result = createProgramSchema.safeParse({
      name: ' ',
      goal: 'HYPERTROPHY',
    });
    expect(result.success).toBe(false);
  });
});

describe('createWorkoutTemplateSchema', () => {
  it('parses a valid empty template', () => {
    expect(
      createWorkoutTemplateSchema.parse({
        name: 'Haut du corps',
        description: null,
        estimatedDurationMinutes: 60,
      }),
    ).toMatchObject({
      name: 'Haut du corps',
      estimatedDurationMinutes: 60,
    });
  });

  it('rejects invalid duration', () => {
    expect(
      createWorkoutTemplateSchema.safeParse({
        name: 'A',
        estimatedDurationMinutes: 0,
      }).success,
    ).toBe(false);
    expect(
      createWorkoutTemplateSchema.safeParse({
        name: 'A',
        estimatedDurationMinutes: 601,
      }).success,
    ).toBe(false);
  });
});

describe('workout template order helpers', () => {
  const a = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const b = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const c = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

  it('computes next 0-based position', () => {
    expect(computeNextWorkoutTemplatePosition([])).toBe(0);
    expect(computeNextWorkoutTemplatePosition([0, 1])).toBe(2);
  });

  it('compacts positions after deletion', () => {
    expect(compactWorkoutTemplatePositions([c, a])).toEqual([
      { id: c, position: 0 },
      { id: a, position: 1 },
    ]);
  });

  it('accepts a valid reorder payload', () => {
    expect(reorderWorkoutTemplatesSchema.parse({ workoutTemplateIds: [a, b] })).toEqual({
      workoutTemplateIds: [a, b],
    });
    expect(validateWorkoutTemplateReorder([b, a, c], [a, b, c])).toEqual({
      ok: true,
    });
  });

  it('rejects duplicate ids in order', () => {
    expect(validateWorkoutTemplateReorder([a, a], [a, b])).toEqual({
      ok: false,
      code: 'WORKOUT_TEMPLATE_DUPLICATE_IN_ORDER',
    });
  });

  it('rejects incomplete order', () => {
    expect(validateWorkoutTemplateReorder([a], [a, b])).toEqual({
      ok: false,
      code: 'WORKOUT_TEMPLATE_ORDER_INCOMPLETE',
    });
  });

  it('rejects foreign ids in order', () => {
    expect(validateWorkoutTemplateReorder([a, c], [a, b])).toEqual({
      ok: false,
      code: 'WORKOUT_TEMPLATE_INVALID_ORDER',
    });
  });
});

describe('addWorkoutTemplateExerciseSchema', () => {
  const exerciseId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  it('parses and normalizes notes', () => {
    expect(
      addWorkoutTemplateExerciseSchema.parse({
        exerciseId,
        equipmentTypeId: null,
        restSecondsOverride: 90,
        notes: '  ',
      }),
    ).toEqual({
      exerciseId,
      equipmentTypeId: null,
      restSecondsOverride: 90,
      notes: null,
    });
  });

  it('rejects invalid rest seconds', () => {
    expect(
      addWorkoutTemplateExerciseSchema.safeParse({
        exerciseId,
        equipmentTypeId: null,
        restSecondsOverride: 1801,
        notes: null,
      }).success,
    ).toBe(false);
  });
});

describe('validateWorkoutTemplateSetTargets', () => {
  const base = {
    targetRepMin: null,
    targetRepMax: null,
    targetDurationSeconds: null,
    targetDistanceMeters: null,
    targetWeightKg: null,
    targetIntensityPercent: null,
    targetRir: null,
    targetRpe: null,
    restSeconds: null,
  };

  it('accepts WEIGHT_REPS with reps and optional weight', () => {
    expect(
      validateWorkoutTemplateSetTargets('WEIGHT_REPS', {
        ...base,
        targetRepMin: 8,
        targetRepMax: 10,
        targetWeightKg: 60,
      }),
    ).toEqual({ ok: true });
  });

  it('requires reps for REPS_ONLY', () => {
    expect(
      validateWorkoutTemplateSetTargets('REPS_ONLY', base).ok,
    ).toBe(false);
  });

  it('requires duration for DURATION and WEIGHT_DURATION', () => {
    expect(validateWorkoutTemplateSetTargets('DURATION', base).ok).toBe(false);
    expect(
      validateWorkoutTemplateSetTargets('WEIGHT_DURATION', {
        ...base,
        targetDurationSeconds: 30,
        targetWeightKg: 20,
      }),
    ).toEqual({ ok: true });
  });

  it('requires distance for DISTANCE_DURATION', () => {
    expect(
      validateWorkoutTemplateSetTargets('DISTANCE_DURATION', {
        ...base,
        targetDistanceMeters: 1000,
        targetDurationSeconds: 300,
      }),
    ).toEqual({ ok: true });
    expect(
      validateWorkoutTemplateSetTargets('DISTANCE_DURATION', {
        ...base,
        targetDurationSeconds: 300,
      }).ok,
    ).toBe(false);
  });

  it('rejects invalid rep range', () => {
    expect(
      validateWorkoutTemplateSetTargets('WEIGHT_REPS', {
        ...base,
        targetRepMin: 10,
        targetRepMax: 5,
      }).code,
    ).toBe('WORKOUT_TEMPLATE_SET_INVALID_REP_RANGE');
  });

  it('rejects simultaneous RIR and RPE', () => {
    expect(
      validateWorkoutTemplateSetTargets('WEIGHT_REPS', {
        ...base,
        targetRepMin: 5,
        targetRepMax: 5,
        targetRir: 2,
        targetRpe: 8,
      }).code,
    ).toBe('WORKOUT_TEMPLATE_SET_CONFLICTING_INTENSITY_TARGETS');
  });

  it('rejects invalid RIR/RPE via schema', () => {
    expect(
      createWorkoutTemplateSetSchema.safeParse({
        setType: 'WORKING',
        ...base,
        targetRepMin: 5,
        targetRepMax: 5,
        targetRir: 11,
      }).success,
    ).toBe(false);
    expect(
      createWorkoutTemplateSetSchema.safeParse({
        setType: 'WORKING',
        ...base,
        targetRepMin: 5,
        targetRepMax: 5,
        targetRpe: 0.5,
      }).success,
    ).toBe(false);
  });

  it('rejects invalid intensity percent via schema', () => {
    expect(
      createWorkoutTemplateSetSchema.safeParse({
        setType: 'WORKING',
        ...base,
        targetRepMin: 5,
        targetRepMax: 5,
        targetIntensityPercent: 0,
      }).success,
    ).toBe(false);
  });

  it('compacts ordered positions generically', () => {
    const idA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const idB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    expect(computeNextOrderedPosition([])).toBe(0);
    expect(compactOrderedPositions([idA, idB])).toEqual([
      { id: idA, position: 0 },
      { id: idB, position: 1 },
    ]);
  });
});
