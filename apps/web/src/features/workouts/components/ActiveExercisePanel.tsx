import type {
  EffortTrackingMode,
  WorkoutSessionDetail,
  WorkoutSessionExerciseDetail,
  WorkoutSessionSetDetail,
  WorkoutSetStatus,
} from '@gym-companion/shared';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { getMeasurementTypeLabel } from '@/features/exercises/lib/exercise-labels';

import {
  countTreatedSetsInExercise,
  getExerciseProgressLabel,
  getExerciseProgressState,
  isExerciseTreated,
} from '../lib/workout-progress';
import { WorkoutSetCard } from './WorkoutSetCard';
import { WorkoutSetFormDialog } from './WorkoutSetFormDialog';

type EditingState = {
  set: WorkoutSessionSetDetail;
  initialStatus?: WorkoutSetStatus;
};

type ActiveExercisePanelProps = {
  session: WorkoutSessionDetail;
  exercise: WorkoutSessionExerciseDetail;
  effortTrackingMode: EffortTrackingMode;
  canRecordSets: boolean;
  nextPendingSetId: string | null;
  onVersionConflict: () => void;
  onSetRecorded: (args: {
    setId: string;
    status: WorkoutSetStatus;
    set: WorkoutSessionSetDetail;
    exercise: WorkoutSessionExerciseDetail;
  }) => void;
  onGoToNextExercise?: () => void;
  hasNextExercise: boolean;
};

export function ActiveExercisePanel({
  session,
  exercise,
  effortTrackingMode,
  canRecordSets,
  nextPendingSetId,
  onVersionConflict,
  onSetRecorded,
  onGoToNextExercise,
  hasNextExercise,
}: ActiveExercisePanelProps) {
  const [editing, setEditing] = useState<EditingState | null>(null);
  const treated = countTreatedSetsInExercise(exercise);
  const progressState = getExerciseProgressState(exercise);

  return (
    <section className="flex flex-col gap-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
      <header className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
          Exercice {exercise.position + 1} ·{' '}
          {getExerciseProgressLabel(progressState)}
        </p>
        <h2 className="text-xl font-semibold">{exercise.exerciseName}</h2>
        <p className="text-sm text-[var(--muted)]">
          {getMeasurementTypeLabel(exercise.measurementType)}
          {exercise.primaryMuscleGroupName
            ? ` · ${exercise.primaryMuscleGroupName}`
            : ''}
          {exercise.equipment.name ? ` · ${exercise.equipment.name}` : ''}
        </p>
        <p className="text-sm text-[var(--muted)]">
          {treated} / {exercise.sets.length} séries enregistrées
          {exercise.restSeconds != null
            ? ` · repos prévu ${exercise.restSeconds} s`
            : ''}
        </p>
        {exercise.notes ? (
          <p className="mt-1 text-sm text-[var(--muted)]">{exercise.notes}</p>
        ) : null}
      </header>

      <ol className="flex flex-col gap-2">
        {exercise.sets.map((set) => (
          <WorkoutSetCard
            key={set.id}
            set={set}
            canRecord={canRecordSets}
            isNext={nextPendingSetId === set.id}
            onEdit={() => setEditing({ set })}
            onSkip={() => setEditing({ set, initialStatus: 'SKIPPED' })}
            onMarkFailed={() => setEditing({ set, initialStatus: 'FAILED' })}
          />
        ))}
      </ol>

      {isExerciseTreated(exercise) && hasNextExercise && onGoToNextExercise ? (
        <Button type="button" onClick={onGoToNextExercise}>
          Passer à l’exercice suivant
        </Button>
      ) : null}

      {editing ? (
        <WorkoutSetFormDialog
          open
          workoutSessionId={session.id}
          sessionExerciseId={exercise.id}
          measurementType={exercise.measurementType}
          effortTrackingMode={effortTrackingMode}
          expectedVersion={session.version}
          set={editing.set}
          initialStatus={editing.initialStatus}
          onClose={() => setEditing(null)}
          onVersionConflict={onVersionConflict}
          onRecorded={(status) => {
            onSetRecorded({
              setId: editing.set.id,
              status,
              set: editing.set,
              exercise,
            });
          }}
        />
      ) : null}
    </section>
  );
}
