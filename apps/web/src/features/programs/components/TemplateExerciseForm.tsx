import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useId, useRef } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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

const fieldClass =
  'min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] px-3 outline-none focus:border-[var(--primary)]';

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
          <p className="mt-0.5 truncate text-sm text-[var(--muted)]">
            {exerciseName}
          </p>
        </div>

        <form
          className="flex min-h-0 flex-1 flex-col"
          noValidate
          onSubmit={handleSubmit(async (values) => {
            await onSubmit(values);
            baselineRef.current = getValues();
          })}
        >
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            <label
              className="flex flex-col gap-1 text-sm"
              htmlFor="template-exercise-equipment"
            >
              <span className="font-medium">Équipement prévu</span>
              <select
                id="template-exercise-equipment"
                className={cn(fieldClass, 'text-sm')}
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
              className="flex flex-col gap-1 text-sm"
              htmlFor="template-exercise-rest"
            >
              <span className="font-medium">Repos prévu (secondes)</span>
              <input
                id="template-exercise-rest"
                type="text"
                inputMode="numeric"
                placeholder="Facultatif"
                className={fieldClass}
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
              className="flex flex-col gap-1 text-sm"
              htmlFor="template-exercise-notes"
            >
              <span className="font-medium">
                Notes{' '}
                <span className="font-normal text-[var(--muted)]">
                  (facultatif)
                </span>
              </span>
              <textarea
                id="template-exercise-notes"
                rows={2}
                className="min-h-[2.75rem] resize-y rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] px-3 py-2 outline-none focus:border-[var(--primary)]"
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
