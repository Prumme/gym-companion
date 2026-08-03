import { describe, expect, it } from 'vitest';

import { parseApiEnv, profileFormSchema, toUpdateProfilePayload } from './index';

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
