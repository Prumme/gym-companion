import type {
  AiCoachProposalPreview,
  AiCoachProposalPreviewExercise,
  AiCoachProposalPreviewWorkout,
} from '@gym-companion/shared';
import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';

import { formatSetSummaryCompact } from '@/features/programs/lib/template-forms';
import {
  getTrainingGoalLabel,
  getWorkoutSetTypeShortLabel,
} from '@/features/programs/lib/program-labels';
import { getWeekdayLabel } from '@/features/programs/lib/weekdays';

type CoachProposalPreviewSheetProps = {
  open: boolean;
  title: string;
  preview: AiCoachProposalPreview;
  onClose: () => void;
};

/**
 * Aperçu en lecture seule d’une proposition Coach IA (jalon 8). Le contenu
 * vient de `previewJson` (dénormalisé côté serveur) : il n’a qu’une valeur
 * d’affichage — l’acceptation revalide toujours `payloadJson`.
 */
export function CoachProposalPreviewSheet({
  open,
  title,
  preview,
  onClose,
}: CoachProposalPreviewSheetProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const workouts: AiCoachProposalPreviewWorkout[] =
    preview.kind === 'PROGRAM' ? preview.program.workouts : [preview.workout];

  return (
    <div className="fixed inset-0 z-50" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-[var(--foreground)]/40"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-[var(--radius-surface)] border border-[var(--border)] bg-[var(--surface)] px-[var(--space-4)] pt-[var(--space-4)] shadow-lg md:inset-x-auto md:right-4 md:bottom-4 md:left-auto md:w-full md:max-w-lg md:rounded-[var(--radius-surface)]"
        style={{
          paddingBottom:
            'calc(var(--space-6) + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="mb-[var(--space-4)] flex items-center justify-between gap-3">
          <h2 id={titleId} className="section-title">
            {title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="inline-flex size-11 items-center justify-center rounded-[var(--radius-control)] text-[var(--muted-foreground)] hover:bg-[var(--background)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
            aria-label="Fermer"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        {preview.kind === 'PROGRAM' ? (
          <div className="mb-4 flex flex-col gap-1 text-sm text-[var(--muted-foreground)]">
            <p>Objectif : {getTrainingGoalLabel(preview.program.goal)}</p>
            {preview.program.description ? (
              <p>{preview.program.description}</p>
            ) : null}
            {preview.program.schedule && preview.program.schedule.length > 0 ? (
              <p>
                Planning proposé :{' '}
                {preview.program.schedule
                  .map(
                    (entry) =>
                      `${getWeekdayLabel(entry.weekday)} → ${
                        workouts[entry.workoutIndex]?.name ?? 'séance'
                      }`,
                  )
                  .join(' · ')}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-5">
          {workouts.map((workout, workoutIndex) => (
            <section key={`${workout.name}-${workoutIndex}`}>
              <h3 className="text-sm font-semibold">{workout.name}</h3>
              {workout.estimatedDurationMinutes != null ? (
                <p className="text-xs text-[var(--muted-foreground)]">
                  ≈ {workout.estimatedDurationMinutes} min
                </p>
              ) : null}
              <ul className="mt-2 flex flex-col gap-3">
                {workout.exercises.map((exercise) => (
                  <ProposalExerciseRow
                    key={exercise.exerciseId}
                    exercise={exercise}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProposalExerciseRow({
  exercise,
}: {
  exercise: AiCoachProposalPreviewExercise;
}) {
  return (
    <li>
      <p className="text-sm font-medium">
        {exercise.exerciseName}
        {exercise.equipmentName ? (
          <span className="text-[var(--muted-foreground)]">
            {' '}
            · {exercise.equipmentName}
          </span>
        ) : null}
      </p>
      {exercise.notes ? (
        <p className="text-xs text-[var(--muted-foreground)]">
          {exercise.notes}
        </p>
      ) : null}
      <ul className="mt-1 flex flex-col divide-y divide-[var(--border)]">
        {exercise.sets.map((set, setIndex) => {
          const compact = formatSetSummaryCompact(set);
          return (
            <li
              key={setIndex}
              className="flex items-center gap-2 py-1 text-xs tabular-nums"
            >
              <span className="w-4 shrink-0 text-[var(--muted-foreground)]">
                {setIndex + 1}
              </span>
              <span className="w-16 shrink-0 truncate font-medium">
                {getWorkoutSetTypeShortLabel(set.setType)}
              </span>
              <span className="min-w-0 flex-1">
                {compact.primary}
                {compact.secondary ? (
                  <span className="text-[var(--muted-foreground)]">
                    {' '}
                    · {compact.secondary}
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    </li>
  );
}
