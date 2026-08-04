import { describe, expect, it } from 'vitest';

import { formatWorkoutSetTargetSummary } from '../lib/workout-labels';

describe('formatWorkoutSetTargetSummary', () => {
  it('affiche les cibles pertinentes pour WEIGHT_REPS', () => {
    expect(
      formatWorkoutSetTargetSummary({
        id: '1',
        position: 0,
        setType: 'WORKING',
        targetWeightKg: 60,
        targetRepMin: 8,
        targetRepMax: 10,
        targetDurationSeconds: null,
        targetDistanceMeters: null,
        targetIntensityPercent: null,
        targetRir: 2,
        targetRpe: null,
        targetRestSeconds: 120,
      }),
    ).toBe('Travail — 8 à 10 répétitions — 60 kg — RIR 2 — repos 120 s');
  });

  it('affiche une série durée', () => {
    expect(
      formatWorkoutSetTargetSummary({
        id: '1',
        position: 0,
        setType: 'WORKING',
        targetWeightKg: null,
        targetRepMin: null,
        targetRepMax: null,
        targetDurationSeconds: 45,
        targetDistanceMeters: null,
        targetIntensityPercent: null,
        targetRir: null,
        targetRpe: null,
        targetRestSeconds: 60,
      }),
    ).toBe('Travail — 45 secondes — repos 60 s');
  });

  it('n’affiche pas les propriétés null', () => {
    const summary = formatWorkoutSetTargetSummary({
      id: '1',
      position: 0,
      setType: 'WARMUP',
      targetWeightKg: null,
      targetRepMin: 12,
      targetRepMax: 12,
      targetDurationSeconds: null,
      targetDistanceMeters: null,
      targetIntensityPercent: null,
      targetRir: null,
      targetRpe: null,
      targetRestSeconds: null,
    });
    expect(summary).toBe('Échauffement — 12 répétitions');
    expect(summary).not.toContain('null');
    expect(summary).not.toContain('RIR');
  });
});
