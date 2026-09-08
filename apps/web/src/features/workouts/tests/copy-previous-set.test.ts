import { describe, expect, it } from 'vitest';

import {
  canCopyPreviousSetIntoCurrent,
  findPreviousSetInExercise,
  hasCopyableActuals,
  pickCopyableActuals,
} from '../lib/copy-previous-set';
import { createWorkoutSet } from './fixtures';

describe('copy-previous-set', () => {
  it('trouve la série immédiatement précédente du même exercice', () => {
    const set1 = createWorkoutSet({ id: 's1', position: 0 });
    const set2 = createWorkoutSet({ id: 's2', position: 1 });
    const set3 = createWorkoutSet({ id: 's3', position: 2 });
    expect(findPreviousSetInExercise([set1, set2, set3], 's2')?.id).toBe('s1');
    expect(findPreviousSetInExercise([set1, set2, set3], 's3')?.id).toBe('s2');
    expect(findPreviousSetInExercise([set1, set2, set3], 's1')).toBeNull();
  });

  it('copie WEIGHT_REPS : charge et répétitions, sans RIR/RPE/notes/targets', () => {
    const previous = createWorkoutSet({
      status: 'COMPLETED',
      actualWeightKg: 70,
      actualReps: 10,
      actualRir: 1,
      actualRpe: 8,
      reachedFailure: true,
      notes: 'lourde',
      targetWeightKg: 60,
      targetRepMin: 8,
      targetRepMax: 10,
    });
    expect(pickCopyableActuals(previous, 'WEIGHT_REPS')).toEqual({
      actualWeightKg: 70,
      actualReps: 10,
    });
  });

  it('copie DURATION : durée uniquement', () => {
    const previous = createWorkoutSet({
      status: 'COMPLETED',
      actualDurationSeconds: 45,
      actualWeightKg: 20,
      actualReps: 10,
      actualRir: 2,
    });
    expect(pickCopyableActuals(previous, 'DURATION')).toEqual({
      actualDurationSeconds: 45,
    });
  });

  it('copie DISTANCE_DURATION : distance et durée', () => {
    const previous = createWorkoutSet({
      actualDistanceMeters: 1000,
      actualDurationSeconds: 300,
      actualWeightKg: 5,
    });
    expect(pickCopyableActuals(previous, 'DISTANCE_DURATION')).toEqual({
      actualDistanceMeters: 1000,
      actualDurationSeconds: 300,
    });
  });

  it('copie BODYWEIGHT_REPS : reps et charge additionnelle si présente', () => {
    const withExtra = createWorkoutSet({
      actualReps: 12,
      actualWeightKg: 10,
    });
    expect(pickCopyableActuals(withExtra, 'BODYWEIGHT_REPS')).toEqual({
      actualWeightKg: 10,
      actualReps: 12,
    });
    const bodyOnly = createWorkoutSet({
      actualReps: 15,
      actualWeightKg: null,
    });
    expect(pickCopyableActuals(bodyOnly, 'BODYWEIGHT_REPS')).toEqual({
      actualReps: 15,
    });
  });

  it('copie ASSISTED_BODYWEIGHT_REPS : assistance et reps', () => {
    const previous = createWorkoutSet({
      actualWeightKg: 20,
      actualReps: 8,
    });
    expect(pickCopyableActuals(previous, 'ASSISTED_BODYWEIGHT_REPS')).toEqual({
      actualWeightKg: 20,
      actualReps: 8,
    });
  });

  it('copie uniquement les valeurs réellement présentes (série partielle)', () => {
    const previous = createWorkoutSet({
      actualWeightKg: 70,
      actualReps: null,
    });
    expect(pickCopyableActuals(previous, 'WEIGHT_REPS')).toEqual({
      actualWeightKg: 70,
    });
  });

  it('désactive si la série précédente n’a aucune valeur exploitable', () => {
    const empty = createWorkoutSet({
      status: 'PENDING',
      actualWeightKg: null,
      actualReps: null,
    });
    expect(hasCopyableActuals(empty, 'WEIGHT_REPS')).toBe(false);
    expect(hasCopyableActuals(null, 'WEIGHT_REPS')).toBe(false);
  });

  it('interdit la copie vers une série COMPLETED', () => {
    expect(canCopyPreviousSetIntoCurrent('COMPLETED')).toBe(false);
    expect(canCopyPreviousSetIntoCurrent('PENDING')).toBe(true);
    expect(canCopyPreviousSetIntoCurrent('PARTIAL')).toBe(true);
  });
});
