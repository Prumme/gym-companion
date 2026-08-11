import type {
  EffortTrackingMode,
  ExerciseMeasurementType,
  WorkoutSessionSetDetail,
  WorkoutSetStatus,
} from '@gym-companion/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useId, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  updateWorkoutSetSchema,
  type UpdateWorkoutSetInput,
} from '@gym-companion/validation';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { getApiErrorMessage, type ApiRequestError } from '@/lib/api/client';
import { cn } from '@/lib/utils';

import { useUpdateWorkoutSetMutation } from '../hooks/use-workout-mutations';
import {
  formatWorkoutSetTargetCompact,
  getWorkoutSetTypeLabelSafe,
} from '../lib/workout-labels';

const formSchema = updateWorkoutSetSchema;

type FormValues = z.infer<typeof formSchema>;

type WorkoutSetFormDialogProps = {
  open: boolean;
  workoutSessionId: string;
  sessionExerciseId: string;
  measurementType: ExerciseMeasurementType;
  effortTrackingMode: EffortTrackingMode;
  expectedVersion: number;
  set: WorkoutSessionSetDetail;
  initialStatus?: WorkoutSetStatus;
  onClose: () => void;
  onVersionConflict: () => void;
  onRecorded?: (status: WorkoutSetStatus) => void;
};

function emptyActuals(): Pick<
  FormValues,
  | 'actualWeightKg'
  | 'actualReps'
  | 'actualDurationSeconds'
  | 'actualDistanceMeters'
  | 'actualRir'
  | 'actualRpe'
> {
  return {
    actualWeightKg: null,
    actualReps: null,
    actualDurationSeconds: null,
    actualDistanceMeters: null,
    actualRir: null,
    actualRpe: null,
  };
}

function buildDefaults(
  set: WorkoutSessionSetDetail,
  effortTrackingMode: EffortTrackingMode,
  expectedVersion: number,
  initialStatus?: WorkoutSetStatus,
): FormValues {
  const isFirst = set.status === 'PENDING';
  const effort =
    effortTrackingMode === 'RIR'
      ? {
          actualRir: isFirst ? set.targetRir : set.actualRir,
          actualRpe: null,
        }
      : effortTrackingMode === 'RPE'
        ? {
            actualRir: null,
            actualRpe: isFirst ? set.targetRpe : set.actualRpe,
          }
        : { actualRir: null, actualRpe: null };

  if (!isFirst) {
    return {
      status:
        initialStatus && initialStatus !== 'CANCELLED'
          ? initialStatus
          : set.status === 'CANCELLED'
            ? 'PENDING'
            : set.status,
      actualWeightKg: set.actualWeightKg,
      actualReps: set.actualReps,
      actualDurationSeconds: set.actualDurationSeconds,
      actualDistanceMeters: set.actualDistanceMeters,
      actualRir: effort.actualRir,
      actualRpe: effort.actualRpe,
      reachedFailure: set.reachedFailure,
      notes: set.notes,
      expectedVersion,
    };
  }

  return {
    status:
      initialStatus &&
      initialStatus !== 'CANCELLED' &&
      initialStatus !== 'PENDING'
        ? initialStatus
        : 'COMPLETED',
    actualWeightKg: set.targetWeightKg,
    actualReps: set.targetRepMax ?? set.targetRepMin,
    actualDurationSeconds: set.targetDurationSeconds,
    actualDistanceMeters: set.targetDistanceMeters,
    actualRir: effort.actualRir,
    actualRpe: effort.actualRpe,
    reachedFailure: false,
    notes: null,
    expectedVersion,
  };
}

function nullableNumber(value: unknown): number | null {
  if (value === '' || value == null) {
    return null;
  }
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

const fieldClass =
  'min-h-12 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] px-3 text-base tabular-nums';

export function WorkoutSetFormDialog({
  open,
  workoutSessionId,
  sessionExerciseId,
  measurementType,
  effortTrackingMode,
  expectedVersion,
  set,
  initialStatus,
  onClose,
  onVersionConflict,
  onRecorded,
}: WorkoutSetFormDialogProps) {
  const titleId = useId();
  const mutation = useUpdateWorkoutSetMutation(workoutSessionId);
  const [confirmClose, setConfirmClose] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const defaults = useMemo(
    () =>
      buildDefaults(set, effortTrackingMode, expectedVersion, initialStatus),
    [set, effortTrackingMode, expectedVersion, initialStatus],
  );

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) {
      reset(
        buildDefaults(set, effortTrackingMode, expectedVersion, initialStatus),
      );
      setConfirmClose(false);
      setMoreOpen(false);
    }
  }, [open, set, effortTrackingMode, expectedVersion, initialStatus, reset]);

  const status = watch('status');

  if (!open) {
    return null;
  }

  const showReps = [
    'WEIGHT_REPS',
    'BODYWEIGHT_REPS',
    'ASSISTED_BODYWEIGHT_REPS',
    'REPS_ONLY',
  ].includes(measurementType);
  const showWeight = [
    'WEIGHT_REPS',
    'BODYWEIGHT_REPS',
    'ASSISTED_BODYWEIGHT_REPS',
    'WEIGHT_DURATION',
  ].includes(measurementType);
  const showDuration = [
    'DURATION',
    'DISTANCE_DURATION',
    'WEIGHT_DURATION',
  ].includes(measurementType);
  const showDistance = measurementType === 'DISTANCE_DURATION';
  const weightLabel =
    measurementType === 'ASSISTED_BODYWEIGHT_REPS'
      ? 'Assistance (kg)'
      : measurementType === 'BODYWEIGHT_REPS'
        ? 'Charge additionnelle (kg)'
        : 'Charge (kg)';
  const compactTarget = formatWorkoutSetTargetCompact(set);
  const typeLabel = getWorkoutSetTypeLabelSafe(set.setType);

  function requestClose() {
    if (mutation.isPending) {
      return;
    }
    if (isDirty) {
      setConfirmClose(true);
      return;
    }
    onClose();
  }

  async function submit(values: FormValues) {
    let payload: UpdateWorkoutSetInput = {
      ...values,
      expectedVersion,
      notes: values.notes?.trim() ? values.notes.trim() : null,
    };

    if (payload.status === 'PENDING' || payload.status === 'SKIPPED') {
      payload = {
        ...payload,
        ...emptyActuals(),
        reachedFailure: false,
      };
    }

    if (effortTrackingMode === 'NONE') {
      payload = { ...payload, actualRir: null, actualRpe: null };
    } else if (effortTrackingMode === 'RIR') {
      payload = { ...payload, actualRpe: null };
    } else if (effortTrackingMode === 'RPE') {
      payload = { ...payload, actualRir: null };
    }

    try {
      await mutation.mutateAsync({
        sessionExerciseId,
        workoutSetId: set.id,
        input: payload,
      });
      onRecorded?.(payload.status);
      onClose();
    } catch (err) {
      const apiError = err as ApiRequestError;
      if (apiError.code === 'WORKOUT_VERSION_CONFLICT') {
        onVersionConflict();
      }
    }
  }

  const apiError =
    mutation.error &&
    (mutation.error as ApiRequestError).code !== 'WORKOUT_VERSION_CONFLICT'
      ? getApiErrorMessage(
          mutation.error,
          'Impossible d’enregistrer cette série.',
        )
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      role="presentation"
      onClick={requestClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[1rem] border border-[var(--border)] bg-[var(--card)] shadow-lg sm:rounded-[var(--radius)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="shrink-0 border-b border-[var(--border)] px-4 pb-3 pt-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--border)] sm:hidden" />
          <h3 id={titleId} className="text-lg font-semibold">
            Série {set.position + 1}
          </h3>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {typeLabel}
            {compactTarget ? ` · ${compactTarget}` : ''}
          </p>
        </div>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            void handleSubmit(submit)(event);
          }}
        >
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="flex flex-col gap-3">
              {status !== 'SKIPPED' && status !== 'PENDING' ? (
                <>
                  {(showWeight || showReps) && (
                    <div
                      className={cn(
                        'grid gap-3',
                        showWeight && showReps
                          ? 'grid-cols-2'
                          : 'grid-cols-1',
                      )}
                    >
                      {showWeight ? (
                        <label className="flex flex-col gap-1 text-sm">
                          <span className="font-medium">{weightLabel}</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.5"
                            min={0}
                            className={fieldClass}
                            {...register('actualWeightKg', {
                              setValueAs: nullableNumber,
                            })}
                          />
                          {errors.actualWeightKg ? (
                            <span className="text-[var(--danger)]" role="alert">
                              {errors.actualWeightKg.message}
                            </span>
                          ) : null}
                        </label>
                      ) : null}

                      {showReps ? (
                        <label className="flex flex-col gap-1 text-sm">
                          <span className="font-medium">Répétitions</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            className={fieldClass}
                            {...register('actualReps', {
                              setValueAs: nullableNumber,
                            })}
                          />
                          {errors.actualReps ? (
                            <span className="text-[var(--danger)]" role="alert">
                              {errors.actualReps.message}
                            </span>
                          ) : null}
                        </label>
                      ) : null}
                    </div>
                  )}

                  {showDuration ? (
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium">Durée (secondes)</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        className={fieldClass}
                        {...register('actualDurationSeconds', {
                          setValueAs: nullableNumber,
                        })}
                      />
                      {errors.actualDurationSeconds ? (
                        <span className="text-[var(--danger)]" role="alert">
                          {errors.actualDurationSeconds.message}
                        </span>
                      ) : null}
                    </label>
                  ) : null}

                  {showDistance ? (
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium">Distance (mètres)</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        className={fieldClass}
                        {...register('actualDistanceMeters', {
                          setValueAs: nullableNumber,
                        })}
                      />
                      {errors.actualDistanceMeters ? (
                        <span className="text-[var(--danger)]" role="alert">
                          {errors.actualDistanceMeters.message}
                        </span>
                      ) : null}
                    </label>
                  ) : null}

                  {effortTrackingMode === 'RIR' ? (
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium">RIR</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={10}
                        className={fieldClass}
                        {...register('actualRir', {
                          setValueAs: nullableNumber,
                        })}
                      />
                    </label>
                  ) : null}

                  {effortTrackingMode === 'RPE' ? (
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium">RPE</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={1}
                        max={10}
                        step="0.5"
                        className={fieldClass}
                        {...register('actualRpe', {
                          setValueAs: nullableNumber,
                        })}
                      />
                    </label>
                  ) : null}

                  <label className="flex min-h-12 items-center justify-between gap-3 rounded-[var(--radius-control)] border border-[var(--border)] px-3 text-sm">
                    <span className="font-medium">Échec musculaire</span>
                    <input
                      type="checkbox"
                      className="size-5 accent-[var(--primary)]"
                      {...register('reachedFailure')}
                    />
                  </label>
                </>
              ) : null}

              <button
                type="button"
                className="self-start text-sm text-[var(--muted)] underline-offset-4 hover:text-[var(--foreground)] hover:underline"
                onClick={() => setMoreOpen((value) => !value)}
                aria-expanded={moreOpen}
              >
                {moreOpen ? 'Masquer les options' : 'Plus d’options'}
              </button>

              <div className={moreOpen ? 'flex flex-col gap-3 border-t border-[var(--border)] pt-3' : 'sr-only'}>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">Statut</span>
                    <select
                      className={cn(fieldClass, 'text-sm')}
                      {...register('status')}
                    >
                      <option value="COMPLETED">Terminée</option>
                      <option value="PARTIAL">Partielle</option>
                      <option value="FAILED">Échouée</option>
                      <option value="SKIPPED">Ignorée</option>
                      <option value="PENDING">À faire</option>
                    </select>
                    {errors.status ? (
                      <span className="text-[var(--danger)]" role="alert">
                        {errors.status.message}
                      </span>
                    ) : null}
                  </label>

                  {status !== 'SKIPPED' && status !== 'PENDING' ? (
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium">Notes</span>
                      <textarea
                        rows={2}
                        className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                        {...register('notes')}
                      />
                    </label>
                  ) : null}
                </div>

              {apiError ? (
                <p className="text-sm text-[var(--danger)]" role="alert">
                  {apiError}
                </p>
              ) : null}
              {(mutation.error as ApiRequestError | null)?.code ===
              'WORKOUT_VERSION_CONFLICT' ? (
                <p className="text-sm text-[var(--danger)]" role="alert">
                  La séance a été modifiée depuis un autre onglet ou appareil.
                  Les dernières données ont été rechargées.
                </p>
              ) : null}
            </div>
          </div>

          <div className="shrink-0 border-t border-[var(--border)] bg-[var(--card)] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Button
              type="submit"
              className="w-full"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
            <div className="mt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                className="min-h-11 px-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-50"
                disabled={mutation.isPending}
                onClick={requestClose}
              >
                Annuler
              </button>
              <button
                type="button"
                className="min-h-11 px-1 text-sm text-[var(--danger)] hover:underline disabled:opacity-50"
                disabled={mutation.isPending}
                onClick={() => {
                  setValue('status', 'SKIPPED');
                  void handleSubmit(submit)();
                }}
              >
                Ignorer la série
              </button>
            </div>
          </div>
        </form>

        {confirmClose ? (
          <div
            className="absolute inset-x-0 bottom-0 z-10 border-t border-[var(--border)] bg-[var(--card)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg"
            role="alertdialog"
            aria-label="Modifications non enregistrées"
          >
            <p className="text-sm">
              Des modifications non enregistrées seront perdues. Fermer quand
              même ?
            </p>
            <div className="mt-2 flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setConfirmClose(false)}
              >
                Continuer la saisie
              </Button>
              <Button type="button" className="flex-1" onClick={onClose}>
                Fermer
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
