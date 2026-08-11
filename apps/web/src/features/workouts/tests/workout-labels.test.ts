import { describe, expect, it } from 'vitest';

import {
  formatWorkoutSetActualCompact,
  formatWorkoutSetActualSummary,
  formatWorkoutSetTargetCompact,
  formatWorkoutSetTargetSummary,
  getWorkoutSetStatusLabel,
} from '../lib/workout-labels';
import { createWorkoutSet } from './fixtures';

describe('workout labels', () => {
  it('formate les cibles pertinentes', () => {
    expect(
      formatWorkoutSetTargetSummary(
        createWorkoutSet({
          targetWeightKg: 60,
          targetRepMin: 8,
          targetRepMax: 10,
          targetRir: 2,
          targetRestSeconds: 120,
        }),
      ),
    ).toBe('Travail — 8 à 10 répétitions — 60 kg — RIR 2 — repos 120 s');
  });

  it('formate les cibles compactes', () => {
    expect(
      formatWorkoutSetTargetCompact(
        createWorkoutSet({
          targetWeightKg: 60,
          targetRepMin: 8,
          targetRepMax: 10,
          targetRir: 2,
        }),
      ),
    ).toBe('8–10 reps · 60 kg · RIR 2');
  });

  it('libellés de statut de série', () => {
    expect(getWorkoutSetStatusLabel('PENDING')).toBe('À faire');
    expect(getWorkoutSetStatusLabel('COMPLETED')).toBe('Terminée');
    expect(getWorkoutSetStatusLabel('PARTIAL')).toBe('Partielle');
    expect(getWorkoutSetStatusLabel('FAILED')).toBe('Échouée');
    expect(getWorkoutSetStatusLabel('SKIPPED')).toBe('Ignorée');
  });

  it('formate le résumé réalisé', () => {
    expect(formatWorkoutSetActualSummary(createWorkoutSet())).toBeNull();
    expect(
      formatWorkoutSetActualSummary(
        createWorkoutSet({
          status: 'COMPLETED',
          actualWeightKg: 60,
          actualReps: 10,
          actualRir: 2,
        }),
      ),
    ).toBe('10 répétitions — 60 kg — RIR 2');
  });

  it('formate le résumé réalisé compact', () => {
    expect(formatWorkoutSetActualCompact(createWorkoutSet())).toBeNull();
    expect(
      formatWorkoutSetActualCompact(
        createWorkoutSet({
          status: 'COMPLETED',
          actualWeightKg: 60,
          actualReps: 10,
          actualRir: 2,
        }),
      ),
    ).toBe('10 reps · 60 kg · RIR 2');
    expect(
      formatWorkoutSetActualCompact(
        createWorkoutSet({ status: 'SKIPPED' }),
      ),
    ).toBe('Ignorée');
  });
});
