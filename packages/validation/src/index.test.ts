import { describe, expect, it } from 'vitest';

import {
  buildExerciseCursorFilter,
  createExerciseSchema,
  decodeExerciseCursor,
  encodeExerciseCursor,
  listExercisesQuerySchema,
  normalizeExerciseName,
  parseApiEnv,
  profileFormSchema,
  toUpdateProfilePayload,
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
