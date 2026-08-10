import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { sharedWorkoutSessionContextQueryOptions } from '../api/shared-workout-query-options';
import { setMySharedCurrentExercise } from '../api/shared-workouts-api';

/**
 * Shared 5.5 — synchronise l’exercice sélectionné dans l’écran workout
 * vers le serveur (room ACTIVE uniquement, online).
 */
export function useSyncSharedCurrentExercise(
  workoutSessionId: string | undefined,
  selectedExerciseId: string | null,
) {
  const contextQuery = useQuery({
    ...sharedWorkoutSessionContextQueryOptions(workoutSessionId ?? ''),
    enabled: Boolean(workoutSessionId),
  });
  const lastSent = useRef<string | null | undefined>(undefined);

  const room = contextQuery.data?.room ?? null;
  const linkedActive =
    Boolean(contextQuery.data?.linked) && room?.status === 'ACTIVE';

  useEffect(() => {
    if (!workoutSessionId || !linkedActive || !room) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    const nextId = selectedExerciseId;
    if (lastSent.current === nextId) return;
    // Skip until context loaded; seed lastSent from serveur to avoid spam.
    if (lastSent.current === undefined) {
      lastSent.current =
        contextQuery.data?.currentWorkoutSessionExerciseId ?? null;
      if (lastSent.current === nextId) return;
    }

    lastSent.current = nextId;
    void setMySharedCurrentExercise(room.id, {
      workoutSessionExerciseId: nextId,
    }).catch(() => {
      // Dégradé : la séance individuelle reste utilisable.
      lastSent.current = undefined;
    });
  }, [
    workoutSessionId,
    selectedExerciseId,
    linkedActive,
    room,
    contextQuery.data?.currentWorkoutSessionExerciseId,
  ]);

  return {
    sharedContext: contextQuery.data ?? null,
    isSharedActive: linkedActive,
  };
}
