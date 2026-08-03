import type { ExerciseListItem } from '@gym-companion/shared';
import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';

import { getApiErrorMessage } from '@/lib/api/client';

import { useUpdateExercisePreferenceMutation } from '../hooks/use-exercise-preference-mutations';
import { getMeasurementTypeLabel } from '../lib/exercise-labels';
import { preferenceToUpdateInput } from '../lib/exercise-preference';
import { ExerciseFavoriteButton } from './ExerciseFavoriteButton';
import { ExerciseSourceBadge } from './ExerciseSourceBadge';

type ExerciseCardProps = {
  exercise: ExerciseListItem;
  onFeedback?: (message: string | null) => void;
};

export function ExerciseCard({ exercise, onFeedback }: ExerciseCardProps) {
  const location = useLocation();
  const mutation = useUpdateExercisePreferenceMutation();
  const [localError, setLocalError] = useState<string | null>(null);

  const equipmentName =
    exercise.userPreference.preferredEquipmentType?.name ??
    exercise.defaultEquipmentType?.name ??
    'Sans équipement';
  const isArchived = exercise.archivedAt !== null;
  const isPending =
    mutation.isPending && mutation.variables?.exerciseId === exercise.id;

  async function handleToggleFavorite() {
    setLocalError(null);
    onFeedback?.(null);
    const nextFavorite = !exercise.userPreference.isFavorite;
    try {
      await mutation.mutateAsync({
        exerciseId: exercise.id,
        input: preferenceToUpdateInput(exercise.userPreference, {
          isFavorite: nextFavorite,
        }),
        optimisticPreference: {
          ...exercise.userPreference,
          isFavorite: nextFavorite,
        },
      });
    } catch (error) {
      const message = getApiErrorMessage(
        error,
        'Impossible de modifier ce favori. Réessaie.',
      );
      setLocalError(message);
      onFeedback?.(message);
    }
  }

  return (
    <article className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
      <div className="flex items-start gap-2">
        <Link
          to={`/exercises/${exercise.id}`}
          state={{ from: `${location.pathname}${location.search}` }}
          className="min-w-0 flex-1 rounded-[var(--radius)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
          aria-label={`Voir le détail de ${exercise.name}`}
        >
          <h2 className="text-base font-semibold leading-snug">{exercise.name}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {exercise.primaryMuscleGroup.name} · {equipmentName}
          </p>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {getMeasurementTypeLabel(exercise.measurementType)}
          </p>
        </Link>

        <ExerciseFavoriteButton
          preference={exercise.userPreference}
          pending={isPending}
          onToggle={() => {
            void handleToggleFavorite();
          }}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ExerciseSourceBadge source={exercise.source} />
        {isArchived ? (
          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
            Archivé
          </span>
        ) : null}
        {exercise.userPreference.restSecondsOverride != null ? (
          <span className="text-xs text-[var(--muted)]">
            Repos perso : {exercise.userPreference.restSecondsOverride}s
          </span>
        ) : null}
      </div>

      {localError ? (
        <p className="mt-2 text-sm text-[var(--danger)]" role="alert">
          {localError}
        </p>
      ) : null}
    </article>
  );
}
