import type { ExerciseMeasurementType } from '@gym-companion/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useId, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';

import { WORKOUT_SET_TYPE_OPTIONS } from '../lib/program-labels';
import {
  measurementNeedsDistance,
  measurementNeedsDuration,
  measurementNeedsReps,
  measurementNeedsWeight,
  type TemplateSetFormValues,
} from '../lib/template-forms';

const setFormSchema = z
  .object({
    setType: z.enum([
      'WARMUP',
      'WORKING',
      'BACKOFF',
      'DROP_SET',
      'AMRAP',
      'FAILURE_OPTIONAL',
    ]),
    targetRepMin: z.string(),
    targetRepMax: z.string(),
    targetDurationMinutes: z.string(),
    targetDurationSeconds: z.string(),
    targetDistanceMeters: z.string(),
    targetWeightKg: z.string(),
    targetIntensityPercent: z.string(),
    targetRir: z.string(),
    targetRpe: z.string(),
    restSeconds: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.targetRir.trim() && values.targetRpe.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Renseigne uniquement RIR ou RPE, pas les deux.',
        path: ['targetRir'],
      });
    }
  });

type TemplateSetEditorProps = {
  open: boolean;
  title: string;
  submitLabel: string;
  measurementType: ExerciseMeasurementType;
  initialValues: TemplateSetFormValues;
  pending?: boolean;
  submitError?: string | null;
  onSubmit: (values: TemplateSetFormValues) => Promise<void> | void;
  onCancel: () => void;
};

export function TemplateSetEditor({
  open,
  title,
  submitLabel,
  measurementType,
  initialValues,
  pending = false,
  submitError = null,
  onSubmit,
  onCancel,
}: TemplateSetEditorProps) {
  const titleId = useId();
  const baselineRef = useRef(initialValues);
  const needsReps = measurementNeedsReps(measurementType);
  const needsDuration = measurementNeedsDuration(measurementType);
  const needsDistance = measurementNeedsDistance(measurementType);
  const needsWeight = measurementNeedsWeight(measurementType);

  const form = useForm<TemplateSetFormValues>({
    resolver: zodResolver(setFormSchema),
    defaultValues: initialValues,
    mode: 'onSubmit',
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = form;

  useEffect(() => {
    if (!open) {
      return;
    }
    reset(initialValues);
    baselineRef.current = initialValues;
  }, [open, initialValues, reset]);

  const current = watch();
  const dirty = JSON.stringify(current) !== JSON.stringify(baselineRef.current);

  if (!open) {
    return null;
  }

  function requestClose() {
    if (pending) {
      return;
    }
    if (
      dirty &&
      !window.confirm(
        'Des modifications non enregistrées seront perdues. Continuer ?',
      )
    ) {
      return;
    }
    onCancel();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="presentation"
      onClick={requestClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id={titleId} className="text-lg font-semibold">
          {title}
        </h3>
        <form
          className="mt-4 flex flex-col gap-4"
          noValidate
          onSubmit={handleSubmit(async (values) => {
            await onSubmit(values);
            baselineRef.current = getValues();
          })}
        >
          <label className="flex flex-col gap-1.5 text-sm" htmlFor="set-type">
            <span className="font-medium">Type de série</span>
            <select
              id="set-type"
              className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 outline-none focus:border-[var(--primary)]"
              {...register('setType')}
            >
              {WORKOUT_SET_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-[var(--muted)]">
              AMRAP = maximum de répétitions ; Allégée = charge réduite après le
              travail.
            </span>
          </label>

          {needsReps ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5 text-sm" htmlFor="set-rep-min">
                <span className="font-medium">Répétitions min.</span>
                <input
                  id="set-rep-min"
                  type="text"
                  inputMode="numeric"
                  className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 outline-none focus:border-[var(--primary)]"
                  {...register('targetRepMin')}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm" htmlFor="set-rep-max">
                <span className="font-medium">Répétitions max.</span>
                <input
                  id="set-rep-max"
                  type="text"
                  inputMode="numeric"
                  className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 outline-none focus:border-[var(--primary)]"
                  {...register('targetRepMax')}
                />
              </label>
            </div>
          ) : null}

          {needsDuration ? (
            <div className="grid grid-cols-2 gap-3">
              <label
                className="flex flex-col gap-1.5 text-sm"
                htmlFor="set-duration-min"
              >
                <span className="font-medium">Minutes</span>
                <input
                  id="set-duration-min"
                  type="text"
                  inputMode="numeric"
                  className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 outline-none focus:border-[var(--primary)]"
                  {...register('targetDurationMinutes')}
                />
              </label>
              <label
                className="flex flex-col gap-1.5 text-sm"
                htmlFor="set-duration-sec"
              >
                <span className="font-medium">Secondes</span>
                <input
                  id="set-duration-sec"
                  type="text"
                  inputMode="numeric"
                  className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 outline-none focus:border-[var(--primary)]"
                  {...register('targetDurationSeconds')}
                />
              </label>
            </div>
          ) : null}

          {needsDistance ? (
            <label
              className="flex flex-col gap-1.5 text-sm"
              htmlFor="set-distance"
            >
              <span className="font-medium">Distance (mètres)</span>
              <input
                id="set-distance"
                type="text"
                inputMode="decimal"
                className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 outline-none focus:border-[var(--primary)]"
                {...register('targetDistanceMeters')}
              />
            </label>
          ) : null}

          {needsWeight ? (
            <label className="flex flex-col gap-1.5 text-sm" htmlFor="set-weight">
              <span className="font-medium">Charge cible (kg)</span>
              <input
                id="set-weight"
                type="text"
                inputMode="decimal"
                placeholder="Facultatif"
                className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 outline-none focus:border-[var(--primary)]"
                {...register('targetWeightKg')}
              />
            </label>
          ) : null}

          <label
            className="flex flex-col gap-1.5 text-sm"
            htmlFor="set-intensity"
          >
            <span className="font-medium">Intensité (%)</span>
            <input
              id="set-intensity"
              type="text"
              inputMode="decimal"
              placeholder="Facultatif"
              className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 outline-none focus:border-[var(--primary)]"
              {...register('targetIntensityPercent')}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-sm" htmlFor="set-rir">
              <span className="font-medium">RIR — Répétitions en réserve</span>
              <input
                id="set-rir"
                type="text"
                inputMode="numeric"
                className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 outline-none focus:border-[var(--primary)]"
                {...register('targetRir', {
                  onChange: (event) => {
                    if (event.target.value.trim()) {
                      setValue('targetRpe', '', { shouldDirty: true });
                    }
                  },
                })}
              />
              {errors.targetRir ? (
                <span className="text-[var(--danger)]" role="alert">
                  {errors.targetRir.message}
                </span>
              ) : null}
            </label>
            <label className="flex flex-col gap-1.5 text-sm" htmlFor="set-rpe">
              <span className="font-medium">RPE — Effort perçu</span>
              <input
                id="set-rpe"
                type="text"
                inputMode="decimal"
                className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 outline-none focus:border-[var(--primary)]"
                {...register('targetRpe', {
                  onChange: (event) => {
                    if (event.target.value.trim()) {
                      setValue('targetRir', '', { shouldDirty: true });
                    }
                  },
                })}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5 text-sm" htmlFor="set-rest">
            <span className="font-medium">Repos après la série (secondes)</span>
            <input
              id="set-rest"
              type="text"
              inputMode="numeric"
              className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 outline-none focus:border-[var(--primary)]"
              {...register('restSeconds')}
            />
          </label>

          {submitError ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {submitError}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={requestClose}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Enregistrement…' : submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
