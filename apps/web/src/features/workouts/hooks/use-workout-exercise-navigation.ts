import type { WorkoutSessionDetail } from '@gym-companion/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { resolveInitialExerciseId } from '../lib/workout-progress';

export function useWorkoutExerciseNavigation(
  session: WorkoutSessionDetail | null | undefined,
) {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramExerciseId = searchParams.get('exerciseId');
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!session) {
      setSelectedExerciseId(null);
      return;
    }
    const nextId = resolveInitialExerciseId(session, paramExerciseId);
    setSelectedExerciseId((current) => {
      if (current && session.exercises.some((ex) => ex.id === current)) {
        return current;
      }
      return nextId;
    });
    if (paramExerciseId && paramExerciseId !== nextId) {
      const next = new URLSearchParams(searchParams);
      if (nextId) {
        next.set('exerciseId', nextId);
      } else {
        next.delete('exerciseId');
      }
      setSearchParams(next, { replace: true });
    }
  }, [session, paramExerciseId, searchParams, setSearchParams]);

  const selectedExercise = useMemo(() => {
    if (!session || !selectedExerciseId) {
      return null;
    }
    return (
      session.exercises.find((exercise) => exercise.id === selectedExerciseId) ??
      null
    );
  }, [session, selectedExerciseId]);

  const selectedIndex = useMemo(() => {
    if (!session || !selectedExerciseId) {
      return -1;
    }
    return session.exercises.findIndex(
      (exercise) => exercise.id === selectedExerciseId,
    );
  }, [session, selectedExerciseId]);

  const selectExercise = useCallback(
    (exerciseId: string) => {
      setSelectedExerciseId(exerciseId);
      const next = new URLSearchParams(searchParams);
      next.set('exerciseId', exerciseId);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const goToPrevious = useCallback(() => {
    if (!session || selectedIndex <= 0) {
      return;
    }
    const prev = session.exercises[selectedIndex - 1];
    if (prev) {
      selectExercise(prev.id);
    }
  }, [session, selectedIndex, selectExercise]);

  const goToNext = useCallback(() => {
    if (!session || selectedIndex < 0) {
      return;
    }
    const nextExercise = session.exercises[selectedIndex + 1];
    if (nextExercise) {
      selectExercise(nextExercise.id);
    }
  }, [session, selectedIndex, selectExercise]);

  return {
    selectedExerciseId,
    selectedExercise,
    selectedIndex,
    selectExercise,
    goToPrevious,
    goToNext,
    hasPrevious: selectedIndex > 0,
    hasNext:
      Boolean(session) &&
      selectedIndex >= 0 &&
      selectedIndex < (session?.exercises.length ?? 0) - 1,
  };
}
