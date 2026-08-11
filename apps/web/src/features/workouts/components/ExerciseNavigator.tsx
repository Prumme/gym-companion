import type { WorkoutSessionExerciseDetail } from '@gym-companion/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

import { getExerciseProgressState } from '../lib/workout-progress';

type ExerciseNavigatorProps = {
  exercises: WorkoutSessionExerciseDetail[];
  selectedExerciseId: string | null;
  onSelect: (exerciseId: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
};

export function ExerciseNavigator({
  exercises,
  selectedExerciseId,
  onSelect,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
}: ExerciseNavigatorProps) {
  const selectedIndex = exercises.findIndex(
    (exercise) => exercise.id === selectedExerciseId,
  );
  const selected =
    selectedIndex >= 0 ? exercises[selectedIndex] : exercises[0] ?? null;
  const positionLabel =
    selectedIndex >= 0
      ? `Exercice ${selectedIndex + 1} / ${exercises.length}`
      : `Exercice — / ${exercises.length}`;

  return (
    <nav className="flex flex-col gap-2" aria-label="Navigation des exercices">
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-[var(--foreground)] hover:bg-[var(--surface)] disabled:pointer-events-none disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          disabled={!hasPrevious}
          aria-label="Aller à l'exercice précédent"
          onClick={onPrevious}
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>

        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-sm font-medium">
            {selected?.exerciseName ?? 'Exercice'}
          </p>
          <p className="text-xs tabular-nums text-[var(--muted)]">
            {positionLabel}
          </p>
        </div>

        <button
          type="button"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-[var(--foreground)] hover:bg-[var(--surface)] disabled:pointer-events-none disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          disabled={!hasNext}
          aria-label="Aller à l'exercice suivant"
          onClick={onNext}
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
      </div>

      {exercises.length > 1 ? (
        <div
          className="flex items-center justify-center gap-1.5"
          role="tablist"
          aria-label="Exercices de la séance"
        >
          {exercises.map((exercise, index) => {
            const state = getExerciseProgressState(exercise);
            const selectedTab = exercise.id === selectedExerciseId;
            return (
              <button
                key={exercise.id}
                type="button"
                role="tab"
                aria-selected={selectedTab}
                aria-label={`${index + 1}. ${exercise.exerciseName}`}
                className={cn(
                  'size-2.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]',
                  selectedTab
                    ? 'bg-[var(--primary)] ring-2 ring-[var(--primary)]/40 ring-offset-2 ring-offset-[var(--background)]'
                    : state === 'TREATED'
                      ? 'bg-[var(--foreground)]/40'
                      : state === 'IN_PROGRESS'
                        ? 'bg-[var(--primary)]/60'
                        : 'bg-[var(--border)]',
                )}
                onClick={() => onSelect(exercise.id)}
              />
            );
          })}
        </div>
      ) : null}
    </nav>
  );
}
