import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useId, useRef } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';

import {
  templateExerciseFormSchema,
  type TemplateExerciseFormValues,
} from '../lib/template-forms';

type TemplateExerciseFormProps = {
  open: boolean;
  title: string;
  submitLabel: string;
  exerciseName: string;
  compatibleEquipment: Array<{ id: string; name: string }>;
  initialValues: TemplateExerciseFormValues;
  pending?: boolean;
  submitError?: string | null;
  onSubmit: (values: TemplateExerciseFormValues) => Promise<void> | void;
  onCancel: () => void;
};

export function TemplateExerciseForm({
  open,
  title,
  submitLabel,
  exerciseName,
  compatibleEquipment,
  initialValues,
  pending = false,
  submitError = null,
  onSubmit,
  onCancel,
}: TemplateExerciseFormProps) {
  const titleId = useId();
  const baselineRef = useRef(initialValues);

  const form = useForm<TemplateExerciseFormValues>({
    resolver: zodResolver(templateExerciseFormSchema),
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
    current.equipmentTypeId !== baselineRef.current.equipmentTypeId ||
    current.restSecondsOverride !== baselineRef.current.restSecondsOverride ||
    current.notes !== baselineRef.current.notes;

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
        <p className="mt-1 text-sm text-[var(--muted)]">{exerciseName}</p>

        <form
          className="mt-4 flex flex-col gap-4"
          noValidate
          onSubmit={handleSubmit(async (values) => {
            await onSubmit(values);
            baselineRef.current = getValues();
          })}
        >
          <label
            className="flex flex-col gap-1.5 text-sm"
            htmlFor="template-exercise-equipment"
          >
            <span className="font-medium">Équipement prévu</span>
            <select
              id="template-exercise-equipment"
              className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 outline-none focus:border-[var(--primary)]"
              {...register('equipmentTypeId')}
            >
              <option value="">Aucun équipement</option>
              {compatibleEquipment.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label
            className="flex flex-col gap-1.5 text-sm"
            htmlFor="template-exercise-rest"
          >
            <span className="font-medium">Repos prévu (secondes)</span>
            <input
              id="template-exercise-rest"
              type="text"
              inputMode="numeric"
              placeholder="Facultatif"
              className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 outline-none focus:border-[var(--primary)]"
              aria-invalid={Boolean(errors.restSecondsOverride)}
              {...register('restSecondsOverride')}
            />
            {errors.restSecondsOverride ? (
              <span className="text-[var(--danger)]" role="alert">
                {errors.restSecondsOverride.message}
              </span>
            ) : null}
          </label>

          <label
            className="flex flex-col gap-1.5 text-sm"
            htmlFor="template-exercise-notes"
          >
            <span className="font-medium">Notes</span>
            <textarea
              id="template-exercise-notes"
              rows={3}
              className="rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 py-2 outline-none focus:border-[var(--primary)]"
              {...register('notes')}
            />
            {errors.notes ? (
              <span className="text-[var(--danger)]" role="alert">
                {errors.notes.message}
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
