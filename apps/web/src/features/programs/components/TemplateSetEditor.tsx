import type { ExerciseMeasurementType } from '@gym-companion/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useId, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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

const fieldClass =
  'min-h-12 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] px-3 text-base tabular-nums outline-none focus:border-[var(--primary)]';

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
  const [moreOpen, setMoreOpen] = useState(false);
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
    setMoreOpen(false);
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
            {title}
          </h3>
        </div>

        <form
          className="flex min-h-0 flex-1 flex-col"
          noValidate
          onSubmit={handleSubmit(async (values) => {
            await onSubmit(values);
            baselineRef.current = getValues();
          })}
        >
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            <label className="flex flex-col gap-1 text-sm" htmlFor="set-type">
              <span className="font-medium">Type</span>
              <select
                id="set-type"
                className={cn(fieldClass, 'text-sm')}
                {...register('setType')}
              >
                {WORKOUT_SET_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {needsReps ? (
              <div>
                <p className="mb-1 text-sm font-medium">Répétitions</p>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <input
                    id="set-rep-min"
                    type="text"
                    inputMode="numeric"
                    aria-label="Répétitions min."
                    className={fieldClass}
                    {...register('targetRepMin')}
                  />
                  <span className="text-sm text-[var(--muted)]">à</span>
                  <input
                    id="set-rep-max"
                    type="text"
                    inputMode="numeric"
                    aria-label="Répétitions max."
                    className={fieldClass}
                    {...register('targetRepMax')}
                  />
                </div>
              </div>
            ) : null}

            {needsWeight ? (
              <label className="flex flex-col gap-1 text-sm" htmlFor="set-weight">
                <span className="font-medium">Charge cible (kg)</span>
                <input
                  id="set-weight"
                  type="text"
                  inputMode="decimal"
                  placeholder="Facultatif"
                  className={fieldClass}
                  {...register('targetWeightKg')}
                />
              </label>
            ) : null}

            {needsDuration ? (
              <div className="grid grid-cols-2 gap-3">
                <label
                  className="flex flex-col gap-1 text-sm"
                  htmlFor="set-duration-min"
                >
                  <span className="font-medium">Minutes</span>
                  <input
                    id="set-duration-min"
                    type="text"
                    inputMode="numeric"
                    className={fieldClass}
                    {...register('targetDurationMinutes')}
                  />
                </label>
                <label
                  className="flex flex-col gap-1 text-sm"
                  htmlFor="set-duration-sec"
                >
                  <span className="font-medium">Secondes</span>
                  <input
                    id="set-duration-sec"
                    type="text"
                    inputMode="numeric"
                    className={fieldClass}
                    {...register('targetDurationSeconds')}
                  />
                </label>
              </div>
            ) : null}

            {needsDistance ? (
              <label
                className="flex flex-col gap-1 text-sm"
                htmlFor="set-distance"
              >
                <span className="font-medium">Distance (mètres)</span>
                <input
                  id="set-distance"
                  type="text"
                  inputMode="decimal"
                  className={fieldClass}
                  {...register('targetDistanceMeters')}
                />
              </label>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm" htmlFor="set-rir">
                <span className="font-medium">RIR</span>
                <input
                  id="set-rir"
                  type="text"
                  inputMode="numeric"
                  className={fieldClass}
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
              <label className="flex flex-col gap-1 text-sm" htmlFor="set-rest">
                <span className="font-medium">Repos (s)</span>
                <input
                  id="set-rest"
                  type="text"
                  inputMode="numeric"
                  className={fieldClass}
                  {...register('restSeconds')}
                />
              </label>
            </div>

            <button
              type="button"
              className="text-sm text-[var(--muted)] underline-offset-4 hover:text-[var(--foreground)] hover:underline"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((value) => !value)}
            >
              {moreOpen ? 'Masquer les options' : 'Plus d’options'}
            </button>

            {moreOpen ? (
              <div className="space-y-3 border-t border-[var(--border)] pt-3">
                <label
                  className="flex flex-col gap-1 text-sm"
                  htmlFor="set-intensity"
                >
                  <span className="font-medium">Intensité (%)</span>
                  <input
                    id="set-intensity"
                    type="text"
                    inputMode="decimal"
                    placeholder="Facultatif"
                    className={fieldClass}
                    {...register('targetIntensityPercent')}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm" htmlFor="set-rpe">
                  <span className="font-medium">RPE</span>
                  <input
                    id="set-rpe"
                    type="text"
                    inputMode="decimal"
                    className={fieldClass}
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
            ) : null}

            {submitError ? (
              <p className="text-sm text-[var(--danger)]" role="alert">
                {submitError}
              </p>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-[var(--border)] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? 'Enregistrement…' : submitLabel}
            </Button>
            <button
              type="button"
              className="mt-2 min-h-11 w-full text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
              disabled={pending}
              onClick={requestClose}
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
