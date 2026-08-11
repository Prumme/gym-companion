import type { WorkoutSessionDetail } from '@gym-companion/shared';
import { useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { getApiErrorMessage, type ApiRequestError } from '@/lib/api/client';

import {
  useCancelWorkoutSessionMutation,
  useCompleteWorkoutSessionMutation,
  usePauseWorkoutSessionMutation,
  useResumeWorkoutSessionMutation,
} from '../hooks/use-workout-mutations';
import { computeWorkoutProgress } from '../lib/workout-progress';

type WorkoutLifecycleActionsProps = {
  session: WorkoutSessionDetail;
  onVersionConflict: () => void;
  showInlineButtons?: boolean;
  completeOpen?: boolean;
  cancelOpen?: boolean;
  onCompleteOpenChange?: (open: boolean) => void;
  onCancelOpenChange?: (open: boolean) => void;
  onPaused?: () => void;
  onResumed?: () => void;
  onTerminated?: () => void;
};

export function WorkoutLifecycleActions({
  session,
  onVersionConflict,
  showInlineButtons = true,
  completeOpen: controlledCompleteOpen,
  cancelOpen: controlledCancelOpen,
  onCompleteOpenChange,
  onCancelOpenChange,
  onPaused,
  onResumed,
  onTerminated,
}: WorkoutLifecycleActionsProps) {
  const navigate = useNavigate();
  const [uncontrolledComplete, setUncontrolledComplete] = useState(false);
  const [uncontrolledCancel, setUncontrolledCancel] = useState(false);
  const [completeNotes, setCompleteNotes] = useState(session.notes ?? '');
  const [cancelReason, setCancelReason] = useState('');
  const notesId = useId();
  const reasonId = useId();

  const completeOpen = controlledCompleteOpen ?? uncontrolledComplete;
  const cancelOpen = controlledCancelOpen ?? uncontrolledCancel;

  function setCompleteOpen(open: boolean) {
    onCompleteOpenChange?.(open);
    if (controlledCompleteOpen === undefined) {
      setUncontrolledComplete(open);
    }
  }

  function setCancelOpen(open: boolean) {
    onCancelOpenChange?.(open);
    if (controlledCancelOpen === undefined) {
      setUncontrolledCancel(open);
    }
  }

  useEffect(() => {
    if (completeOpen) {
      setCompleteNotes(session.notes ?? '');
    }
  }, [completeOpen, session.notes]);

  useEffect(() => {
    if (cancelOpen) {
      setCancelReason('');
    }
  }, [cancelOpen]);

  const pauseMutation = usePauseWorkoutSessionMutation(session.id);
  const resumeMutation = useResumeWorkoutSessionMutation(session.id);
  const completeMutation = useCompleteWorkoutSessionMutation(session.id);
  const cancelMutation = useCancelWorkoutSessionMutation(session.id);

  const progress = computeWorkoutProgress(session);

  function handleLifecycleError(error: unknown, preserveDialog: boolean) {
    const apiError = error as ApiRequestError;
    if (apiError.code === 'WORKOUT_VERSION_CONFLICT') {
      onVersionConflict();
      if (!preserveDialog) {
        setCompleteOpen(false);
        setCancelOpen(false);
      }
      return;
    }
    if (
      apiError.code === 'WORKOUT_INVALID_STATUS_TRANSITION' ||
      apiError.code === 'WORKOUT_NOT_FOUND'
    ) {
      onVersionConflict();
      setCompleteOpen(false);
      setCancelOpen(false);
    }
  }

  async function onPause() {
    try {
      await pauseMutation.mutateAsync({ expectedVersion: session.version });
      onPaused?.();
    } catch (error) {
      handleLifecycleError(error, false);
    }
  }

  async function onResume() {
    try {
      await resumeMutation.mutateAsync({ expectedVersion: session.version });
      onResumed?.();
    } catch (error) {
      handleLifecycleError(error, false);
    }
  }

  async function onComplete() {
    try {
      const result = await completeMutation.mutateAsync({
        expectedVersion: session.version,
        notes: completeNotes.trim() === '' ? null : completeNotes.trim(),
      });
      setCompleteOpen(false);
      onTerminated?.();
      void navigate(`/workouts/${result.workoutSession.id}`);
    } catch (error) {
      handleLifecycleError(error, true);
    }
  }

  async function onCancel() {
    try {
      const result = await cancelMutation.mutateAsync({
        expectedVersion: session.version,
        keepRecordedData: true,
        reason: cancelReason.trim() === '' ? null : cancelReason.trim(),
      });
      setCancelOpen(false);
      onTerminated?.();
      void navigate(`/workouts/${result.workoutSession.id}`);
    } catch (error) {
      handleLifecycleError(error, true);
    }
  }

  const anyPending =
    pauseMutation.isPending ||
    resumeMutation.isPending ||
    completeMutation.isPending ||
    cancelMutation.isPending;

  const versionConflict =
    (pauseMutation.error as ApiRequestError | null)?.code ===
      'WORKOUT_VERSION_CONFLICT' ||
    (resumeMutation.error as ApiRequestError | null)?.code ===
      'WORKOUT_VERSION_CONFLICT' ||
    (completeMutation.error as ApiRequestError | null)?.code ===
      'WORKOUT_VERSION_CONFLICT' ||
    (cancelMutation.error as ApiRequestError | null)?.code ===
      'WORKOUT_VERSION_CONFLICT';

  return (
    <div className="flex flex-col gap-2">
      {versionConflict ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          La séance a été modifiée depuis un autre onglet ou appareil.
        </p>
      ) : null}

      {showInlineButtons ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {session.permissions.canPause ? (
            <Button
              type="button"
              variant="secondary"
              disabled={anyPending}
              onClick={() => {
                void onPause();
              }}
            >
              {pauseMutation.isPending ? 'Pause…' : 'Mettre en pause'}
            </Button>
          ) : null}
          {session.permissions.canResume ? (
            <Button
              type="button"
              disabled={anyPending}
              onClick={() => {
                void onResume();
              }}
            >
              {resumeMutation.isPending ? 'Reprise…' : 'Reprendre la séance'}
            </Button>
          ) : null}
          {session.permissions.canComplete ? (
            <Button
              type="button"
              disabled={anyPending}
              onClick={() => {
                setCompleteNotes(session.notes ?? '');
                setCompleteOpen(true);
              }}
            >
              Terminer la séance
            </Button>
          ) : null}
          {session.permissions.canCancel ? (
            <Button
              type="button"
              variant="destructive"
              disabled={anyPending}
              onClick={() => {
                setCancelReason('');
                setCancelOpen(true);
              }}
            >
              Annuler la séance
            </Button>
          ) : null}
        </div>
      ) : null}

      {completeOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="presentation"
          onClick={() => {
            if (!completeMutation.isPending) setCompleteOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${notesId}-title`}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id={`${notesId}-title`} className="text-lg font-semibold">
              Terminer la séance ?
            </h3>
            <ul className="mt-2 list-inside list-disc text-sm text-[var(--muted)]">
              <li>
                {progress.recordedSets}/{progress.totalSets} séries traitées
              </li>
              <li>
                {progress.pendingSets} série
                {progress.pendingSets === 1 ? '' : 's'} restante
                {progress.pendingSets === 1 ? '' : 's'}
              </li>
              <li>
                {progress.treatedExercises}/{progress.totalExercises} exercices
                traités
              </li>
              <li>
                Terminées {progress.completedSets} · Partielles{' '}
                {progress.partialSets} · Échouées {progress.failedSets} ·
                Ignorées {progress.skippedSets}
              </li>
            </ul>
            {progress.pendingSets > 0 ? (
              <p className="mt-2 text-sm text-[var(--muted)]" role="status">
                Certaines séries sont encore à faire. {progress.pendingSets}{' '}
                série{progress.pendingSets === 1 ? '' : 's'} sur{' '}
                {progress.totalSets}{' '}
                {progress.pendingSets === 1 ? 'est' : 'sont'} encore à faire.
              </p>
            ) : null}
            {progress.recordedSets === 0 ? (
              <p className="mt-2 text-sm text-[var(--muted)]" role="status">
                Aucune série n’a encore été enregistrée.
              </p>
            ) : null}
            <label
              className="mt-3 flex flex-col gap-1 text-sm"
              htmlFor={notesId}
            >
              <span className="font-medium">Notes (facultatif)</span>
              <textarea
                id={notesId}
                rows={1}
                value={completeNotes}
                onChange={(event) => setCompleteNotes(event.target.value)}
                className="min-h-10 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-3 py-2"
              />
            </label>
            {completeMutation.error &&
            (completeMutation.error as ApiRequestError).code !==
              'WORKOUT_VERSION_CONFLICT' ? (
              <p className="mt-2 text-sm text-[var(--danger)]" role="alert">
                {getApiErrorMessage(
                  completeMutation.error,
                  'Impossible de terminer la séance.',
                )}
              </p>
            ) : null}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                disabled={completeMutation.isPending}
                onClick={() => setCompleteOpen(false)}
              >
                Continuer la séance
              </Button>
              <Button
                type="button"
                disabled={completeMutation.isPending}
                onClick={() => {
                  void onComplete();
                }}
              >
                {completeMutation.isPending
                  ? 'Enregistrement…'
                  : progress.pendingSets > 0 || progress.recordedSets === 0
                    ? 'Terminer quand même'
                    : 'Terminer la séance'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {cancelOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="presentation"
          onClick={() => {
            if (!cancelMutation.isPending) setCancelOpen(false);
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`${reasonId}-title`}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id={`${reasonId}-title`} className="text-lg font-semibold">
              Annuler cette séance ?
            </h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              La séance sera conservée dans tes données avec le statut Annulée.
              Les séries déjà enregistrées seront conservées.
            </p>
            <label
              className="mt-3 flex flex-col gap-1 text-sm"
              htmlFor={reasonId}
            >
              <span className="font-medium">Motif de l’annulation</span>
              <textarea
                id={reasonId}
                rows={2}
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-3 py-2"
              />
            </label>
            {cancelMutation.error &&
            (cancelMutation.error as ApiRequestError).code !==
              'WORKOUT_VERSION_CONFLICT' ? (
              <p className="mt-2 text-sm text-[var(--danger)]" role="alert">
                {getApiErrorMessage(
                  cancelMutation.error,
                  'Impossible d’annuler la séance.',
                )}
              </p>
            ) : null}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                disabled={cancelMutation.isPending}
                onClick={() => setCancelOpen(false)}
              >
                Garder la séance
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={cancelMutation.isPending}
                onClick={() => {
                  void onCancel();
                }}
              >
                {cancelMutation.isPending ? 'Annulation…' : 'Annuler la séance'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
