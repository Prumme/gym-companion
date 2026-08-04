import type { WorkoutSessionExerciseDetail } from '@gym-companion/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import {
  countTreatedSetsInExercise,
  getExerciseProgressLabel,
  getExerciseProgressState,
} from '../lib/workout-progress';

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
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          className="shrink-0"
          disabled={!hasPrevious}
          aria-label="Exercice précédent"
          onClick={onPrevious}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only sm:ml-1">Précédent</span>
        </Button>
        <div
          className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1"
          role="tablist"
          aria-label="Exercices de la séance"
        >
          {exercises.map((exercise) => {
            const treated = countTreatedSetsInExercise(exercise);
            const state = getExerciseProgressState(exercise);
            const selected = exercise.id === selectedExerciseId;
            return (
              <button
                key={exercise.id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={cn(
                  'min-w-[9.5rem] shrink-0 rounded-[var(--radius)] border px-3 py-2 text-left transition-colors',
                  selected
                    ? 'border-[var(--primary)] bg-[var(--card)]'
                    : 'border-[var(--border)] bg-[var(--background)]',
                )}
                onClick={() => onSelect(exercise.id)}
              >
                <p className="truncate text-xs font-semibold">
                  {exercise.position + 1}. {exercise.exerciseName}
                </p>
                <p className="mt-1 text-[11px] text-[var(--muted)]">
                  {treated} / {exercise.sets.length} ·{' '}
                  {getExerciseProgressLabel(state)}
                </p>
              </button>
            );
          })}
        </div>
        <Button
          type="button"
          variant="secondary"
          className="shrink-0"
          disabled={!hasNext}
          aria-label="Exercice suivant"
          onClick={onNext}
        >
          <span className="sr-only sm:not-sr-only sm:mr-1">Suivant</span>
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
