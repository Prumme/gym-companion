import type { LastWorkingSetCue } from '@gym-companion/shared';
import { describe, expect, it } from 'vitest';

import {
  getLastTimeCopyDisabledReason,
  pickLastTimeActuals,
  supportsLastTimeCopy,
} from '../lib/copy-last-time';

function cue(overrides: Partial<LastWorkingSetCue> = {}): LastWorkingSetCue {
  return {
    exerciseId: 'ex-1',
    actualWeightKg: 80,
    actualReps: 6,
    actualDurationSeconds: 40,
    actualDistanceMeters: 500,
    setType: 'WORKING',
    localDate: '2026-11-10',
    workoutSessionId: 'w-old',
    workoutSetId: 'ws-old',
    ...overrides,
  };
}

describe('pickLastTimeActuals', () => {
  it('reprend charge et reps pour WEIGHT_REPS, sans durée ni distance', () => {
    expect(pickLastTimeActuals(cue(), 'WEIGHT_REPS')).toEqual({
      actualWeightKg: 80,
      actualReps: 6,
    });
  });

  it('respecte la visibilité des champs (REPS_ONLY → reps seules)', () => {
    expect(pickLastTimeActuals(cue(), 'REPS_ONLY')).toEqual({ actualReps: 6 });
  });

  it('WEIGHT_DURATION → charge seule (la durée n’est pas reprise)', () => {
    expect(pickLastTimeActuals(cue(), 'WEIGHT_DURATION')).toEqual({ actualWeightKg: 80 });
  });

  it('ignore les valeurs nulles', () => {
    expect(pickLastTimeActuals(cue({ actualWeightKg: null }), 'WEIGHT_REPS')).toEqual({
      actualReps: 6,
    });
  });

  it('retourne un objet vide sans repère', () => {
    expect(pickLastTimeActuals(null, 'WEIGHT_REPS')).toEqual({});
    expect(pickLastTimeActuals(undefined, 'WEIGHT_REPS')).toEqual({});
  });
});

describe('supportsLastTimeCopy', () => {
  it('vaut true pour les types avec charge ou reps uniquement', () => {
    expect(supportsLastTimeCopy('WEIGHT_REPS')).toBe(true);
    expect(supportsLastTimeCopy('BODYWEIGHT_REPS')).toBe(true);
    expect(supportsLastTimeCopy('REPS_ONLY')).toBe(true);
    expect(supportsLastTimeCopy('DURATION')).toBe(false);
    expect(supportsLastTimeCopy('DISTANCE_DURATION')).toBe(false);
  });
});

describe('getLastTimeCopyDisabledReason', () => {
  it('est disponible avec des données et une série non terminée', () => {
    expect(getLastTimeCopyDisabledReason(cue(), 'WEIGHT_REPS', 'PENDING')).toBeNull();
    expect(getLastTimeCopyDisabledReason(cue(), 'WEIGHT_REPS', 'PARTIAL')).toBeNull();
  });

  it('refuse une série COMPLETED', () => {
    expect(getLastTimeCopyDisabledReason(cue(), 'WEIGHT_REPS', 'COMPLETED')).toMatch(
      /déjà terminée/,
    );
  });

  it('refuse sans donnée exploitable', () => {
    expect(getLastTimeCopyDisabledReason(null, 'WEIGHT_REPS', 'PENDING')).toMatch(
      /Aucune performance/,
    );
    expect(
      getLastTimeCopyDisabledReason(
        cue({ actualWeightKg: null, actualReps: null }),
        'WEIGHT_REPS',
        'PENDING',
      ),
    ).toMatch(/Aucune performance/);
  });
});
