import { useQuery } from '@tanstack/react-query';

import { exerciseDetailQueryOptions } from '@/features/exercises/api/exercise-query-options';
import { ExerciseMediaButton } from '@/features/exercises/components/ExerciseMediaButton';

const EXERCISE_MEDIA_STALE_TIME_MS = 30 * 60 * 1000;

type SessionExerciseMediaButtonProps = {
  sourceExerciseId: string | null;
  exerciseName: string;
  browserOffline?: boolean;
};

/**
 * Démonstration pendant la séance : la séance ne stocke qu’un snapshot, le média
 * est donc lu depuis la fiche catalogue (`sourceExerciseId`). Sans réseau ou sans
 * média connu, l’icône n’est pas affichée.
 */
export function SessionExerciseMediaButton({
  sourceExerciseId,
  exerciseName,
  browserOffline = false,
}: SessionExerciseMediaButtonProps) {
  const query = useQuery({
    ...exerciseDetailQueryOptions(sourceExerciseId ?? ''),
    enabled: sourceExerciseId !== null && !browserOffline,
    staleTime: EXERCISE_MEDIA_STALE_TIME_MS,
    retry: false,
  });

  if (!sourceExerciseId || !query.data?.media) {
    return null;
  }

  return <ExerciseMediaButton exerciseName={exerciseName} media={query.data.media} />;
}
