import type {
  EffortTrackingMode,
  WorkoutSessionDetail,
  WorkoutSessionExerciseDetail,
  WorkoutSessionSetDetail,
} from '@gym-companion/shared';
import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { getMeasurementTypeLabel } from '@/features/exercises/lib/exercise-labels';
import { cn } from '@/lib/utils';

import {
  formatWorkoutSetActualSummary,
  formatWorkoutSetTargetSummary,
  getWorkoutSetStatusLabel,
} from '../lib/workout-labels';
import { WorkoutSetFormDialog } from './WorkoutSetFormDialog';

type WorkoutSessionExerciseListProps = {
  session: WorkoutSessionDetail;
  effortTrackingMode: EffortTrackingMode;
  canRecordSets: boolean;
  onVersionConflict: () => void;
  highlightedSetId?: string | null;
};

export function WorkoutSessionExerciseList({
  session,
  effortTrackingMode,
  canRecordSets,
  onVersionConflict,
  highlightedSetId = null,
}: WorkoutSessionExerciseListProps) {
  return (
    <ol className="flex flex-col gap-3">
      {session.exercises.map((exercise) => (
        <WorkoutSessionExerciseItem
          key={exercise.id}
          session={session}
          exercise={exercise}
          effortTrackingMode={effortTrackingMode}
          canRecordSets={canRecordSets}
          onVersionConflict={onVersionConflict}
          highlightedSetId={highlightedSetId}
        />
      ))}
    </ol>
  );
}

function WorkoutSessionExerciseItem({
  session,
  exercise,
  effortTrackingMode,
  canRecordSets,
  onVersionConflict,
  highlightedSetId,
}: {
  session: WorkoutSessionDetail;
  exercise: WorkoutSessionExerciseDetail;
  effortTrackingMode: EffortTrackingMode;
  canRecordSets: boolean;
  onVersionConflict: () => void;
  highlightedSetId: string | null;
}) {
  const titleId = useId();
  const [expanded, setExpanded] = useState(true);
  const [editingSet, setEditingSet] = useState<WorkoutSessionSetDetail | null>(
    null,
  );

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
        <div
          id={`${titleId}-panel`}
          className="border-t border-[var(--border)] px-3 pb-3"
        >
          {exercise.notes ? (
            <p className="mt-3 text-sm text-[var(--muted)]">{exercise.notes}</p>
          ) : null}
          <ol className="mt-3 flex flex-col gap-2">
            {exercise.sets.map((set) => {
              const actual = formatWorkoutSetActualSummary(set);
              const highlighted = highlightedSetId === set.id;
              return (
                <li
                  key={set.id}
                  id={`set-${set.id}`}
                  className={cn(
                    'rounded-[var(--radius)] bg-[var(--background)] px-3 py-3',
                    highlighted
                      ? 'ring-2 ring-[var(--primary)] ring-offset-2'
                      : '',
                  )}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        Série {set.position + 1} ·{' '}
                        {formatWorkoutSetTargetSummary(set).split(' — ')[0]}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Cible :{' '}
                        {formatWorkoutSetTargetSummary(set)
                          .split(' — ')
                          .slice(1)
                          .join(' — ') || '—'}
                      </p>
                      <p className="mt-1 text-xs">
                        Statut :{' '}
                        {!canRecordSets && set.status === 'PENDING'
                          ? 'Non réalisée'
                          : getWorkoutSetStatusLabel(set.status)}
                      </p>
                      {set.reachedFailure ? (
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          Échec musculaire : Oui
                        </p>
                      ) : set.status !== 'PENDING' &&
                        set.status !== 'SKIPPED' ? (
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          Échec musculaire : Non
                        </p>
                      ) : null}
                      {set.notes ? (
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          Notes : {set.notes}
                        </p>
                      ) : null}
                      {set.completedAt ? (
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          Validée :{' '}
                          {new Intl.DateTimeFormat('fr-FR', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          }).format(new Date(set.completedAt))}
                        </p>
                      ) : null}
                      {actual ? (
                        <p className="mt-1 text-sm">Réalisé : {actual}</p>
                      ) : null}
                    </div>
                    {canRecordSets ? (
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full shrink-0 sm:w-auto"
                        onClick={() => setEditingSet(set)}
                      >
                        {set.status === 'PENDING' ? 'Saisir' : 'Modifier'}
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}

      {editingSet ? (
        <WorkoutSetFormDialog
          open
          workoutSessionId={session.id}
          sessionExerciseId={exercise.id}
          measurementType={exercise.measurementType}
          effortTrackingMode={effortTrackingMode}
          expectedVersion={session.version}
          set={editingSet}
          onClose={() => setEditingSet(null)}
          onVersionConflict={() => {
            onVersionConflict();
          }}
        />
      ) : null}
    </li>
  );
}
