import type { WorkoutSessionExerciseDetail } from '@gym-companion/shared';
import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';

import { getMeasurementTypeLabel } from '@/features/exercises/lib/exercise-labels';
import { cn } from '@/lib/utils';

import { formatWorkoutSetTargetSummary } from '../lib/workout-labels';

type WorkoutSessionExerciseListProps = {
  exercises: WorkoutSessionExerciseDetail[];
};

export function WorkoutSessionExerciseList({
  exercises,
}: WorkoutSessionExerciseListProps) {
  return (
    <ol className="flex flex-col gap-3">
      {exercises.map((exercise) => (
        <WorkoutSessionExerciseItem key={exercise.id} exercise={exercise} />
      ))}
    </ol>
  );
}

function WorkoutSessionExerciseItem({
  exercise,
}: {
  exercise: WorkoutSessionExerciseDetail;
}) {
  const titleId = useId();
  const [expanded, setExpanded] = useState(true);

  return (
    <li className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 p-3 text-left"
        aria-expanded={expanded}
        aria-controls={`${titleId}-panel`}
        onClick={() => setExpanded((value) => !value)}
      >
        <div>
          <p className="text-sm font-semibold">
            {exercise.position + 1}. {exercise.exerciseName}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {getMeasurementTypeLabel(exercise.measurementType)}
            {exercise.equipment.name ? ` · ${exercise.equipment.name}` : ''}
            {exercise.restSeconds != null
              ? ` · repos ${exercise.restSeconds} s`
              : ''}
          </p>
          {exercise.sourceExerciseArchivedAtCreation ? (
            <p className="mt-1 text-xs text-[var(--muted)]">
              Source archivée au moment du démarrage
            </p>
          ) : null}
        </div>
        <ChevronDown
          className={cn(
            'mt-0.5 size-5 shrink-0 text-[var(--muted)] transition-transform',
            expanded ? 'rotate-180' : '',
          )}
          aria-hidden="true"
        />
      </button>

      {expanded ? (
        <div id={`${titleId}-panel`} className="border-t border-[var(--border)] px-3 pb-3">
          {exercise.notes ? (
            <p className="mt-3 text-sm text-[var(--muted)]">{exercise.notes}</p>
          ) : null}
          <ol className="mt-3 flex flex-col gap-2">
            {exercise.sets.map((set) => (
              <li
                key={set.id}
                className="rounded-[var(--radius)] bg-[var(--background)] px-3 py-2 text-sm"
              >
                {formatWorkoutSetTargetSummary(set)}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </li>
  );
}
