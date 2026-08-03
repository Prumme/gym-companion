import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useId, useRef } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';

import {
  EMPTY_WORKOUT_TEMPLATE_FORM_VALUES,
  workoutTemplateFormSchema,
  type WorkoutTemplateFormValues,
} from '../lib/workout-template-form';

type WorkoutTemplateFormProps = {
  open: boolean;
  title: string;
  submitLabel: string;
  initialValues?: WorkoutTemplateFormValues;
  pending?: boolean;
  submitError?: string | null;
  onSubmit: (values: WorkoutTemplateFormValues) => Promise<void> | void;
  onCancel: () => void;
};

export function WorkoutTemplateForm({
  open,
  title,
  submitLabel,
  initialValues = EMPTY_WORKOUT_TEMPLATE_FORM_VALUES,
  pending = false,
  submitError = null,
  onSubmit,
  onCancel,
}: WorkoutTemplateFormProps) {
  const titleId = useId();
  const baselineRef = useRef(initialValues);

  const form = useForm<WorkoutTemplateFormValues>({
    resolver: zodResolver(workoutTemplateFormSchema),
    defaultValues: initialValues,
    mode: 'onSubmit',
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
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
  const dirty =
    current.name !== baselineRef.current.name ||
    current.description !== baselineRef.current.description ||
    current.estimatedDurationMinutes !==
      baselineRef.current.estimatedDurationMinutes;

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
          <label className="flex flex-col gap-1.5 text-sm" htmlFor="template-name">
            <span className="font-medium">Nom</span>
            <input
              id="template-name"
              type="text"
              className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 outline-none focus:border-[var(--primary)]"
              aria-invalid={Boolean(errors.name)}
              {...register('name')}
            />
            {errors.name ? (
              <span className="text-[var(--danger)]" role="alert">
                {errors.name.message}
              </span>
            ) : null}
          </label>

          <label
            className="flex flex-col gap-1.5 text-sm"
            htmlFor="template-description"
          >
            <span className="font-medium">Description</span>
            <textarea
              id="template-description"
              rows={3}
              className="rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 py-2 outline-none focus:border-[var(--primary)]"
              {...register('description')}
            />
            {errors.description ? (
              <span className="text-[var(--danger)]" role="alert">
                {errors.description.message}
              </span>
            ) : null}
          </label>

          <label
            className="flex flex-col gap-1.5 text-sm"
            htmlFor="template-duration"
          >
            <span className="font-medium">Durée estimée (minutes)</span>
            <input
              id="template-duration"
              type="text"
              inputMode="numeric"
              className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 outline-none focus:border-[var(--primary)]"
              placeholder="Facultatif"
              aria-invalid={Boolean(errors.estimatedDurationMinutes)}
              {...register('estimatedDurationMinutes')}
            />
            {errors.estimatedDurationMinutes ? (
              <span className="text-[var(--danger)]" role="alert">
                {errors.estimatedDurationMinutes.message}
              </span>
            ) : null}
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
