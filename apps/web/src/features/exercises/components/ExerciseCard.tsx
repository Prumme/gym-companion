import type { ExerciseListItem } from '@gym-companion/shared';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { getApiErrorMessage } from '@/lib/api/client';
import { cn } from '@/lib/utils';

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
    <article className={cn('border-b border-[var(--border)] py-3', isArchived && 'opacity-70')}>
      <div className="flex min-h-11 items-start gap-1">
        <Link
          to={`/exercises/${exercise.id}`}
          state={{ from: `${location.pathname}${location.search}` }}
          className="min-w-0 flex-1 rounded-[var(--radius-control)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
          aria-label={`Voir le détail de ${exercise.name}`}
        >
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold leading-snug text-[var(--foreground)]">
                  {exercise.name}
                </h2>
                <ExerciseSourceBadge source={exercise.source} />
                {isArchived ? (
                  <span className="text-[0.6875rem] font-medium tracking-wide text-[var(--muted-foreground)] uppercase">
                    Archivé
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                {exercise.primaryMuscleGroup.name} · {equipmentName}
              </p>
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                {getMeasurementTypeLabel(exercise.measurementType)}
              </p>
            </div>
            <ChevronRight
              className="mt-0.5 size-4 shrink-0 text-[var(--muted-foreground)]"
              aria-hidden="true"
            />
          </div>
        </Link>

        <ExerciseFavoriteButton
          preference={exercise.userPreference}
          pending={isPending}
          onToggle={() => {
            void handleToggleFavorite();
          }}
        />
      </div>

      {localError ? (
        <p className="mt-1 text-sm text-[var(--danger)]" role="alert">
          {localError}
        </p>
      ) : null}
    </article>
  );
}
