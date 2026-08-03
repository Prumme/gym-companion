import { describe, expect, it } from 'vitest';

import { parseApiEnv } from './index';

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
