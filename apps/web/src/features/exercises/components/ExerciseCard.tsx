import type { ExerciseListItem } from '@gym-companion/shared';
import { Star } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import { getMeasurementTypeLabel } from '../lib/exercise-labels';
import { ExerciseSourceBadge } from './ExerciseSourceBadge';

type ExerciseCardProps = {
  exercise: ExerciseListItem;
};

export function ExerciseCard({ exercise }: ExerciseCardProps) {
  const location = useLocation();
  const equipmentName =
    exercise.userPreference.preferredEquipmentType?.name ??
    exercise.defaultEquipmentType?.name ??
    'Sans équipement';
  const isFavorite = exercise.userPreference.isFavorite;
  const isArchived = exercise.archivedAt !== null;

  return (
    <Link
      to={`/exercises/${exercise.id}`}
      state={{ from: `${location.pathname}${location.search}` }}
      className="block rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm transition hover:border-[var(--primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
      aria-label={`Voir le détail de ${exercise.name}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold leading-snug">{exercise.name}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {exercise.primaryMuscleGroup.name} · {equipmentName}
          </p>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {getMeasurementTypeLabel(exercise.measurementType)}
          </p>
        </div>
        {isFavorite ? (
          <span className="inline-flex items-center gap-1 text-amber-600" title="Favori">
            <Star className="size-4 fill-current" aria-hidden="true" />
            <span className="sr-only">Favori</span>
          </span>
        ) : null}
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
    </Link>
  );
}
