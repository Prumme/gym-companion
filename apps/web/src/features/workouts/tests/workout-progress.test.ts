import { describe, expect, it } from 'vitest';

import {
  computeWorkoutProgress,
  findNextPendingSet,
  getExerciseProgressState,
  isExerciseTreated,
  resolveInitialExerciseId,
  resolveRestSeconds,
  shouldAutoStartRest,
  shouldSuppressRestAfterSet,
  willExerciseBeTreatedAfterSet,
} from '../lib/workout-progress';
import {
  createWorkoutSessionDetail,
  createWorkoutSet,
} from './fixtures';

function multiExerciseSession() {
  return createWorkoutSessionDetail({
    exercises: [
      {
        id: 'wse-1',
        position: 0,
        sourceExerciseId: 'ex-1',
        exerciseName: 'Développé couché',
        measurementType: 'WEIGHT_REPS',
        primaryMuscleGroupName: 'Pectoraux',
        sourceExerciseArchivedAtCreation: false,
        equipment: { id: 'eq-1', code: 'barbell', name: 'Barre' },
        notes: null,
        restSeconds: 90,
        sets: [
          createWorkoutSet({ id: 'ws-1', status: 'COMPLETED', actualReps: 8 }),
          createWorkoutSet({ id: 'ws-2', position: 1, status: 'PENDING' }),
        ],
      },
      {
        id: 'wse-2',
        position: 1,
        sourceExerciseId: 'ex-2',
        exerciseName: 'Développé militaire',
        measurementType: 'WEIGHT_REPS',
        primaryMuscleGroupName: 'Épaules',
        sourceExerciseArchivedAtCreation: false,
        equipment: { id: 'eq-1', code: 'barbell', name: 'Barre' },
        notes: null,
        restSeconds: 60,
        sets: [
          createWorkoutSet({ id: 'ws-3', status: 'PENDING' }),
          createWorkoutSet({ id: 'ws-4', position: 1, status: 'PENDING' }),
        ],
      },
    ],
  });
}

describe('workout-progress', () => {
  it('calcule la progression globale', () => {
    const session = multiExerciseSession();
    const progress = computeWorkoutProgress(session);
    expect(progress.totalSets).toBe(4);
    expect(progress.recordedSets).toBe(1);
    expect(progress.pendingSets).toBe(3);
    expect(progress.completedSets).toBe(1);
    expect(progress.totalExercises).toBe(2);
    expect(progress.treatedExercises).toBe(0);
  });

  it('détecte un exercice traité même si toutes les séries ont échoué', () => {
    const exercise = {
      sets: [
        createWorkoutSet({ status: 'FAILED' }),
        createWorkoutSet({ id: 'ws-2', position: 1, status: 'SKIPPED' }),
      ],
    };
    expect(isExerciseTreated(exercise)).toBe(true);
    expect(getExerciseProgressState(exercise)).toBe('TREATED');
  });

  it('classe À commencer / En cours / Traité', () => {
    expect(
      getExerciseProgressState({
        sets: [createWorkoutSet({ status: 'PENDING' })],
      }),
    ).toBe('NOT_STARTED');
    expect(
      getExerciseProgressState({
        sets: [
          createWorkoutSet({ status: 'COMPLETED' }),
          createWorkoutSet({ id: 'b', position: 1, status: 'PENDING' }),
        ],
      }),
    ).toBe('IN_PROGRESS');
    expect(
      getExerciseProgressState({
        sets: [createWorkoutSet({ status: 'PARTIAL' })],
      }),
    ).toBe('TREATED');
  });

  it('trouve la prochaine série PENDING', () => {
    const next = findNextPendingSet(multiExerciseSession());
    expect(next?.setId).toBe('ws-2');
    expect(next?.exerciseId).toBe('wse-1');
  });

  it('sélectionne l’exercice initial de façon déterministe', () => {
    const session = multiExerciseSession();
    expect(resolveInitialExerciseId(session)).toBe('wse-1');
    expect(resolveInitialExerciseId(session, 'wse-2')).toBe('wse-2');
    expect(resolveInitialExerciseId(session, 'inconnu')).toBe('wse-1');

    const allDone = createWorkoutSessionDetail({
      exercises: [
        {
          ...session.exercises[0]!,
          sets: [
            createWorkoutSet({ id: 'ws-1', status: 'COMPLETED' }),
            createWorkoutSet({ id: 'ws-2', position: 1, status: 'COMPLETED' }),
          ],
        },
        {
          ...session.exercises[1]!,
          sets: [
            createWorkoutSet({ id: 'ws-3', status: 'SKIPPED' }),
            createWorkoutSet({ id: 'ws-4', position: 1, status: 'FAILED' }),
          ],
        },
      ],
    });
    expect(resolveInitialExerciseId(allDone)).toBe('wse-1');
  });

  it('résout le repos snapshot série puis exercice', () => {
    expect(
      resolveRestSeconds(
        createWorkoutSet({ targetRestSeconds: 120 }),
        { restSeconds: 90 },
      ),
    ).toBe(120);
    expect(
      resolveRestSeconds(
        createWorkoutSet({ targetRestSeconds: null }),
        { restSeconds: 90 },
      ),
    ).toBe(90);
    expect(
      resolveRestSeconds(
        createWorkoutSet({ targetRestSeconds: 0 }),
        { restSeconds: null },
      ),
    ).toBeNull();
  });

  it('démarre automatiquement le repos sauf pour SKIPPED', () => {
    expect(shouldAutoStartRest('COMPLETED')).toBe(true);
    expect(shouldAutoStartRest('PARTIAL')).toBe(true);
    expect(shouldAutoStartRest('FAILED')).toBe(true);
    expect(shouldAutoStartRest('SKIPPED')).toBe(false);
    expect(shouldAutoStartRest('PENDING')).toBe(false);
  });

  it('supprime le repos après la dernière série du dernier exercice', () => {
    const session = createWorkoutSessionDetail();
    const exercise = session.exercises[0]!;
    expect(
      shouldSuppressRestAfterSet({
        session,
        exercise,
        setId: exercise.sets[0]!.id,
        status: 'COMPLETED',
      }),
    ).toBe(true);

    const multi = createWorkoutSessionDetail({
      exercises: [
        {
          ...exercise,
          id: 'wse-1',
          sets: [
            createWorkoutSet({ id: 'ws-1', status: 'PENDING' }),
            createWorkoutSet({ id: 'ws-2', position: 1, status: 'PENDING' }),
          ],
        },
        {
          ...exercise,
          id: 'wse-2',
          position: 1,
          exerciseName: 'Row',
          sets: [createWorkoutSet({ id: 'ws-3', status: 'PENDING' })],
        },
      ],
    });
    expect(
      shouldSuppressRestAfterSet({
        session: multi,
        exercise: multi.exercises[0]!,
        setId: 'ws-1',
        status: 'COMPLETED',
      }),
    ).toBe(false);
    expect(
      willExerciseBeTreatedAfterSet(multi.exercises[0]!, 'ws-1', 'COMPLETED'),
    ).toBe(false);
  });
});
