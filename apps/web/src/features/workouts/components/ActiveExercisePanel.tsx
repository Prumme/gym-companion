import type {
  EffortTrackingMode,
  ExerciseMeasurementType,
  WorkoutSessionDetail,
  WorkoutSessionExerciseDetail,
  WorkoutSessionSetDetail,
  WorkoutSetStatus,
} from '@gym-companion/shared';
import { ArrowLeftRight, Check, MoreHorizontal } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { getMeasurementTypeLabel } from '@/features/exercises/lib/exercise-labels';
import { getApiErrorMessage } from '@/lib/api/client';

import { useReplaceWorkoutSessionExerciseMutation } from '../hooks/use-workout-mutations';
import {
  formatWorkoutSetTargetCompact,
  getWorkoutSetTypeLabelSafe,
} from '../lib/workout-labels';
import {
  findNextPendingSetInExercise,
  isExerciseTreated,
} from '../lib/workout-progress';
import { ReplaceSessionExerciseSheet } from './ReplaceSessionExerciseSheet';
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
  exerciseIndex: number;
  totalExercises: number;
  onVersionConflict: () => void;
  onSetRecorded: (args: {
    setId: string;
    status: WorkoutSetStatus;
    set: WorkoutSessionSetDetail;
    exercise: WorkoutSessionExerciseDetail;
  }) => void;
  onGoToNextExercise?: () => void;
  hasNextExercise: boolean;
  onOpenComplete?: () => void;
  /** Masque le CTA sticky si le timer de repos occupe le bas. */
  restTimerActive?: boolean;
  browserOffline?: boolean;
};

function formatExerciseMeta(exercise: WorkoutSessionExerciseDetail): string {
  const parts: string[] = [];
  const measurement = shortMeasurementLabel(exercise.measurementType);
  const equipment = exercise.equipment.name?.trim() || null;

  if (exercise.measurementType === 'BODYWEIGHT_REPS') {
    parts.push('Poids du corps');
  } else if (
    exercise.measurementType === 'WEIGHT_REPS' &&
    equipment
  ) {
    parts.push(equipment);
  } else if (
    exercise.measurementType === 'ASSISTED_BODYWEIGHT_REPS'
  ) {
    parts.push(equipment ? `Assistance · ${equipment}` : 'Assistance');
  } else {
    parts.push(measurement);
    if (
      equipment &&
      !measurement.toLowerCase().includes(equipment.toLowerCase())
    ) {
      parts.push(equipment);
    }
  }

  if (exercise.primaryMuscleGroupName) {
    parts.push(exercise.primaryMuscleGroupName);
  }

  return parts.join(' · ');
}

function shortMeasurementLabel(type: ExerciseMeasurementType): string {
  switch (type) {
    case 'WEIGHT_REPS':
      return 'Charge';
    case 'BODYWEIGHT_REPS':
      return 'Poids du corps';
    case 'ASSISTED_BODYWEIGHT_REPS':
      return 'Assistance';
    case 'REPS_ONLY':
      return 'Répétitions';
    case 'DURATION':
      return 'Durée';
    case 'DISTANCE_DURATION':
      return 'Distance';
    case 'WEIGHT_DURATION':
      return 'Charge · durée';
    default:
      return getMeasurementTypeLabel(type);
  }
}

export function ActiveExercisePanel({
  session,
  exercise,
  effortTrackingMode,
  canRecordSets,
  nextPendingSetId,
  exerciseIndex,
  totalExercises,
  onVersionConflict,
  onSetRecorded,
  onGoToNextExercise,
  hasNextExercise,
  onOpenComplete,
  restTimerActive = false,
  browserOffline = false,
}: ActiveExercisePanelProps) {
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replaceFeedback, setReplaceFeedback] = useState<string | null>(null);
  const [replaceError, setReplaceError] = useState<string | null>(null);
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const replaceMutation = useReplaceWorkoutSessionExerciseMutation(session.id);

  const treated = isExerciseTreated(exercise);
  const hasRecordedSets = exercise.sets.some((set) => set.status !== 'PENDING');
  const canReplace =
    session.status === 'ACTIVE' &&
    !hasRecordedSets &&
    !browserOffline &&
    exercise.sourceExerciseId != null;

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!replaceFeedback) return;
    const timer = window.setTimeout(() => setReplaceFeedback(null), 2500);
    return () => window.clearTimeout(timer);
  }, [replaceFeedback]);

  const nextSet =
    nextPendingSetId != null
      ? (exercise.sets.find((set) => set.id === nextPendingSetId) ??
        findNextPendingSetInExercise(exercise))
      : findNextPendingSetInExercise(exercise);
  const isLastExercise = exerciseIndex >= totalExercises - 1;

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-2xl font-semibold tracking-tight uppercase sm:normal-case sm:text-3xl">
            {exercise.exerciseName}
          </h2>
          <div className="flex shrink-0 items-start gap-1">
            <span className="pt-1 text-xs tabular-nums text-[var(--muted)]">
              {exerciseIndex + 1} / {totalExercises}
            </span>
            <div className="relative" ref={menuRef}>
              <Button
                type="button"
                variant="ghost"
                className="size-11 min-h-11 px-0"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-controls={menuId}
                aria-label="Actions de l’exercice"
                onClick={() => setMenuOpen((value) => !value)}
              >
                <MoreHorizontal className="size-5" aria-hidden="true" />
              </Button>
              {menuOpen ? (
                <div
                  id={menuId}
                  role="menu"
                  className="absolute right-0 z-20 mt-1 min-w-56 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] py-1 shadow-lg"
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!canReplace}
                    title={
                      browserOffline
                        ? 'Connexion nécessaire pour remplacer un exercice.'
                        : hasRecordedSets
                          ? 'Cet exercice a déjà des séries enregistrées. Supprime ou réinitialise ses séries avant de le remplacer.'
                          : session.status !== 'ACTIVE'
                            ? 'Reprenez la séance pour remplacer un exercice.'
                            : undefined
                    }
                    onClick={() => {
                      setMenuOpen(false);
                      setReplaceError(null);
                      setReplaceOpen(true);
                    }}
                  >
                    <ArrowLeftRight className="size-4 shrink-0" aria-hidden="true" />
                    Remplacer l’exercice
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <p className="text-sm text-[var(--muted)]">
          {formatExerciseMeta(exercise)}
        </p>
        {exercise.notes ? (
          <p className="text-sm text-[var(--muted)]">{exercise.notes}</p>
        ) : null}
        {replaceFeedback ? (
          <p className="text-sm text-[var(--foreground)]" role="status">
            {replaceFeedback}
          </p>
        ) : null}
      </header>

      {treated ? (
        <div
          className="flex flex-col items-start gap-2 border-y border-[var(--border)] py-4"
          role="status"
        >
          <p className="flex items-center gap-2 text-base font-semibold">
            <Check
              className="size-5 text-[var(--primary-foreground)]"
              aria-hidden="true"
            />
            Exercice terminé
          </p>
          <p className="text-sm text-[var(--muted)]">
            Toutes les séries de cet exercice sont traitées.
          </p>
        </div>
      ) : nextSet && canRecordSets ? (
        <div className="flex flex-col gap-3 border-y border-[var(--border)] py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Série suivante
            </p>
            <p className="mt-0.5 text-sm font-medium">
              {getWorkoutSetTypeLabelSafe(nextSet.setType)}
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight">
              {formatWorkoutSetTargetCompact(nextSet) || '—'}
            </p>
            {nextSet.targetRestSeconds != null &&
            nextSet.targetRestSeconds > 0 ? (
              <p className="mt-1 text-sm text-[var(--muted)]">
                Repos {nextSet.targetRestSeconds} s
              </p>
            ) : exercise.restSeconds != null && exercise.restSeconds > 0 ? (
              <p className="mt-1 text-sm text-[var(--muted)]">
                Repos {exercise.restSeconds} s
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Séries
        </h3>
        <ol className="flex flex-col divide-y divide-[var(--border)]">
          {exercise.sets.map((set) => (
            <WorkoutSetCard
              key={set.id}
              set={set}
              canRecord={canRecordSets}
              isNext={nextPendingSetId === set.id}
              onEdit={() => setEditing({ set })}
              onSkip={() => setEditing({ set, initialStatus: 'SKIPPED' })}
              onMarkFailed={() =>
                setEditing({ set, initialStatus: 'FAILED' })
              }
            />
          ))}
        </ol>
      </div>

      {(() => {
        const showComplete =
          treated &&
          isLastExercise &&
          !hasNextExercise &&
          Boolean(onOpenComplete);
        // Pendant le repos entre exercices, le CTA « suivant » vit dans le RestTimer.
        const showNext =
          treated &&
          hasNextExercise &&
          Boolean(onGoToNextExercise) &&
          !restTimerActive;
        const showRecord =
          !treated && Boolean(nextSet) && canRecordSets && !restTimerActive;

        // Fin de séance : toujours prioritaire, même si un timer était encore actif.
        if (showComplete) {
          return (
            <div className="sticky bottom-0 z-30 -mx-4 border-t border-[var(--border)] bg-[var(--background)]/95 px-4 pt-3 backdrop-blur-sm pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:mx-0 sm:rounded-b-[var(--radius)]">
              <Button
                type="button"
                className="w-full"
                onClick={onOpenComplete}
              >
                Terminer la séance
              </Button>
            </div>
          );
        }

        if (!showNext && !showRecord) return null;
        return (
          <div className="sticky bottom-0 z-10 -mx-4 border-t border-[var(--border)] bg-[var(--background)]/95 px-4 pt-3 backdrop-blur-sm pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:mx-0 sm:rounded-b-[var(--radius)]">
            {showNext ? (
              <Button
                type="button"
                className="w-full"
                onClick={onGoToNextExercise}
              >
                Exercice suivant
              </Button>
            ) : null}
            {showRecord && nextSet ? (
              <Button
                type="button"
                className="w-full"
                onClick={() => setEditing({ set: nextSet })}
              >
                Enregistrer la série
              </Button>
            ) : null}
          </div>
        );
      })()}

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

      <ReplaceSessionExerciseSheet
        open={replaceOpen}
        currentExercise={exercise}
        measurementType={exercise.measurementType}
        pending={replaceMutation.isPending}
        errorMessage={replaceError}
        onClose={() => {
          if (!replaceMutation.isPending) {
            setReplaceOpen(false);
            setReplaceError(null);
          }
        }}
        onReplace={(chosen) => {
          setReplaceError(null);
          replaceMutation.mutate(
            {
              sessionExerciseId: exercise.id,
              input: {
                exerciseId: chosen.id,
                expectedVersion: session.version,
              },
            },
            {
              onSuccess: () => {
                setReplaceOpen(false);
                setReplaceFeedback('Exercice remplacé');
              },
              onError: (error) => {
                const code =
                  error &&
                  typeof error === 'object' &&
                  'code' in error &&
                  typeof (error as { code: unknown }).code === 'string'
                    ? (error as { code: string }).code
                    : null;
                if (code === 'WORKOUT_VERSION_CONFLICT') {
                  onVersionConflict();
                }
                if (code === 'OFFLINE' || (error as { status?: number }).status === 0) {
                  setReplaceError(
                    'Connexion nécessaire pour remplacer un exercice.',
                  );
                  return;
                }
                setReplaceError(
                  getApiErrorMessage(
                    error,
                    'Impossible de remplacer cet exercice.',
                  ),
                );
              },
            },
          );
        }}
      />
    </section>
  );
}
