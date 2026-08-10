import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { getApiErrorMessage, type ApiRequestError } from '@/lib/api/client';

import { sharedWorkoutSessionContextQueryOptions } from '../api/shared-workout-query-options';
import { setMySharedCurrentExercise } from '../api/shared-workouts-api';

/**
 * Shared 5.5/5.6 — synchronise l’exercice sélectionné vers le serveur
 * (room ACTIVE, online). Refuse clairement si USING un autre équipement.
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
  const [syncError, setSyncError] = useState<string | null>(null);

  const room = contextQuery.data?.room ?? null;
  const linkedActive =
    Boolean(contextQuery.data?.linked) && room?.status === 'ACTIVE';

  useEffect(() => {
    if (!workoutSessionId || !linkedActive || !room) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    const nextId = selectedExerciseId;
    if (lastSent.current === nextId) return;
    if (lastSent.current === undefined) {
      lastSent.current =
        contextQuery.data?.currentWorkoutSessionExerciseId ?? null;
      if (lastSent.current === nextId) return;
    }

    lastSent.current = nextId;
    setSyncError(null);
    void setMySharedCurrentExercise(room.id, {
      workoutSessionExerciseId: nextId,
    }).catch((error: unknown) => {
      lastSent.current = undefined;
      const code = (error as ApiRequestError | undefined)?.code;
      if (code === 'SHARED_EQUIPMENT_STILL_USING') {
        setSyncError(
          'Libère ton équipement actuel avant de changer d’exercice dans la séance partagée.',
        );
        return;
      }
      setSyncError(
        getApiErrorMessage(
          error,
          'Impossible de synchroniser l’exercice courant partagé.',
        ),
      );
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
    syncError,
  };
}
