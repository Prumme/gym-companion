import { INTERVAL_PRESETS } from '@gym-companion/validation';
import { describe, expect, it } from 'vitest';

import {
  applyIntervalPreset,
  defaultIntervalBuilderValues,
  intervalBuilderValuesToPlan,
} from '../lib/interval-builder-form';

describe('interval builder form', () => {
  it('convertit les valeurs par défaut (1′/1′ × 10, échauffement 5 min)', () => {
    const result = intervalBuilderValuesToPlan(defaultIntervalBuilderValues());
    expect(result).toEqual({
      ok: true,
      plan: {
        rounds: 10,
        work: { durationSeconds: 60, speedKmh: 8, inclinePercent: null },
        recovery: { durationSeconds: 60, speedKmh: 4, inclinePercent: null },
        warmupSeconds: 300,
        cooldownSeconds: null,
      },
    });
  });

  it('applique un préréglage 3/1', () => {
    const values = applyIntervalPreset(
      defaultIntervalBuilderValues(),
      INTERVAL_PRESETS.find((preset) => preset.id === '3-1')!,
    );
    expect(values).toMatchObject({ workSeconds: '180', recoverySeconds: '60', rounds: '5' });
  });

  it('accepte la virgule décimale', () => {
    const result = intervalBuilderValuesToPlan({
      ...defaultIntervalBuilderValues(),
      workSpeedKmh: '8,5',
    });
    expect(result.ok && result.plan.work.speedKmh).toBe(8.5);
  });

  it('signale les champs invalides', () => {
    const result = intervalBuilderValuesToPlan({
      ...defaultIntervalBuilderValues(),
      rounds: '0',
      workSeconds: '',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(['rounds', 'workSeconds']);
    }
  });
});
