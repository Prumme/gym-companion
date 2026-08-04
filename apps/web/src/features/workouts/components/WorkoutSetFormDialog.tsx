import type {
  EffortTrackingMode,
  ExerciseMeasurementType,
  WorkoutSessionSetDetail,
} from '@gym-companion/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useId, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import {
  updateWorkoutSetSchema,
  type UpdateWorkoutSetInput,
} from '@gym-companion/validation';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { getApiErrorMessage, type ApiRequestError } from '@/lib/api/client';

import { useUpdateWorkoutSetMutation } from '../hooks/use-workout-mutations';
import { formatWorkoutSetTargetSummary } from '../lib/workout-labels';

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
  onClose: () => void;
  onVersionConflict: () => void;
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
      status: set.status === 'CANCELLED' ? 'PENDING' : set.status,
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
    status: 'COMPLETED',
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

export function WorkoutSetFormDialog({
  open,
  workoutSessionId,
  sessionExerciseId,
  measurementType,
  effortTrackingMode,
  expectedVersion,
  set,
  onClose,
  onVersionConflict,
}: WorkoutSetFormDialogProps) {
  const titleId = useId();
  const mutation = useUpdateWorkoutSetMutation(workoutSessionId);
  const defaults = useMemo(
    () => buildDefaults(set, effortTrackingMode, expectedVersion),
    [set, effortTrackingMode, expectedVersion],
  );

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) {
      reset(buildDefaults(set, effortTrackingMode, expectedVersion));
    }
  }, [open, set, effortTrackingMode, expectedVersion, reset]);

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

  async function submit(values: FormValues) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      mutation.reset();
      return;
    }

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
      onClose();
    } catch (err) {
      const apiError = err as ApiRequestError;
      if (apiError.code === 'WORKOUT_VERSION_CONFLICT') {
        onVersionConflict();
      }
    }
  }

  const offline =
    typeof navigator !== 'undefined' && navigator.onLine === false;
  const apiError =
    mutation.error &&
    (mutation.error as ApiRequestError).code !== 'WORKOUT_VERSION_CONFLICT'
      ? getApiErrorMessage(
          mutation.error,
          'Impossible d’enregistrer cette série.',
        )
      : offline
        ? 'Une connexion est nécessaire pour enregistrer cette série.'
        : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="presentation"
      onClick={() => {
        if (!mutation.isPending) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id={titleId} className="text-lg font-semibold">
          Série {set.position + 1}
        </h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Cible : {formatWorkoutSetTargetSummary(set) || '—'}
        </p>

        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(event) => {
            void handleSubmit(submit)(event);
          }}
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Statut</span>
            <select
              className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-3"
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
            <>
              {showWeight ? (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">{weightLabel}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    min={0}
                    className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-3"
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
                    className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-3"
                    {...register('actualReps', { setValueAs: nullableNumber })}
                  />
                  {errors.actualReps ? (
                    <span className="text-[var(--danger)]" role="alert">
                      {errors.actualReps.message}
                    </span>
                  ) : null}
                </label>
              ) : null}

              {showDuration ? (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">Durée (secondes)</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-3"
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
                    className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-3"
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
                    className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-3"
                    {...register('actualRir', { setValueAs: nullableNumber })}
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
                    className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-3"
                    {...register('actualRpe', { setValueAs: nullableNumber })}
                  />
                </label>
              ) : null}

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...register('reachedFailure')} />
                <span>Échec musculaire atteint</span>
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Notes</span>
                <textarea
                  rows={2}
                  className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                  {...register('notes')}
                />
              </label>
            </>
          ) : null}

          {apiError ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {apiError}
            </p>
          ) : null}
          {(mutation.error as ApiRequestError | null)?.code ===
          'WORKOUT_VERSION_CONFLICT' ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              La séance a été modifiée depuis un autre onglet ou appareil. Les
              dernières données ont été rechargées.
            </p>
          ) : null}

          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              disabled={mutation.isPending}
              onClick={() => {
                setValue('status', 'SKIPPED');
                void handleSubmit(submit)();
              }}
            >
              Ignorer la série
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={mutation.isPending}
              onClick={onClose}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={mutation.isPending || offline}>
              {mutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
