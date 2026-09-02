import { describe, expect, it } from 'vitest';

import type { PersonalRecord } from '@gym-companion/shared';

import {
  formatLoadCue,
  pickMaxWeightRecord,
  supportsWeightLoadCue,
} from '../hooks/use-active-workout-load-cues';

const record = (overrides: Partial<PersonalRecord> = {}): PersonalRecord => ({
  exerciseId: 'ex-1',
  exercise: {
    id: 'ex-1',
    name: 'Presse',
    measurementType: 'WEIGHT_REPS',
    archived: false,
  },
  equipment: { id: 'eq-bar', name: 'Barre' },
  recordType: 'MAX_WEIGHT',
  value: 110,
  context: {
    weightKg: 110,
    reps: 3,
    durationSeconds: null,
    distanceMeters: null,
    rir: null,
    rpe: null,
    reachedFailure: false,
    setType: 'WORKING',
  },
  achievedOn: '2026-08-01',
  achievedAt: null,
  source: {
    workoutSessionId: 'ws-1',
    workoutSessionExerciseId: 'wse-1',
    workoutSetId: 'set-1',
  },
  ...overrides,
});

describe('repères de charge Active Workout', () => {
  it('formate poids × reps', () => {
    expect(formatLoadCue(80, 10)).toBe('80 kg × 10');
    expect(formatLoadCue(110, null)).toBe('110 kg');
    expect(formatLoadCue(null, 10)).toBeNull();
  });

  it('sélectionne le MAX_WEIGHT du couple exercice + équipement', () => {
    const records = [
      record({
        equipment: { id: 'eq-machine', name: 'Machine' },
        value: 200,
        context: { ...record().context, weightKg: 200, reps: 1 },
      }),
      record(),
    ];
    expect(pickMaxWeightRecord(records, 'ex-1', 'eq-bar')?.value).toBe(110);
    expect(pickMaxWeightRecord(records, 'ex-1', 'eq-other')).toBeNull();
  });

  it('n’expose les records de charge que pour les types avec poids', () => {
    expect(supportsWeightLoadCue('WEIGHT_REPS')).toBe(true);
    expect(supportsWeightLoadCue('WEIGHT_DURATION')).toBe(true);
    expect(supportsWeightLoadCue('DURATION')).toBe(false);
    expect(supportsWeightLoadCue('BODYWEIGHT_REPS')).toBe(false);
  });
});
