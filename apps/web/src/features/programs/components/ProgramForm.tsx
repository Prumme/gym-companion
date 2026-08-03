import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';

import { Button, ButtonLink } from '@/components/ui/button';

import { TRAINING_GOAL_OPTIONS } from '../lib/program-labels';
import {
  EMPTY_PROGRAM_FORM_VALUES,
  programFormSchema,
  type ProgramFormValues,
} from '../lib/program-form';

type ProgramFormProps = {
  mode: 'create' | 'edit';
  initialValues?: ProgramFormValues;
  pending?: boolean;
  submitError?: string | null;
  cancelTo: string;
  submitLabel: string;
  onSubmit: (values: ProgramFormValues) => Promise<void> | void;
};

export function ProgramForm({
  mode,
  initialValues = EMPTY_PROGRAM_FORM_VALUES,
  pending = false,
  submitError = null,
  cancelTo,
  submitLabel,
  onSubmit,
}: ProgramFormProps) {
  const initializedRef = useRef(false);
  const baselineRef = useRef(initialValues);

  const form = useForm<ProgramFormValues>({
    resolver: zodResolver(programFormSchema),
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
    if (mode === 'create') {
      return;
    }
    if (initializedRef.current) {
      return;
    }
    reset(initialValues);
    baselineRef.current = initialValues;
    initializedRef.current = true;
  }, [initialValues, mode, reset]);

  const current = watch();
  const dirty =
    current.name !== baselineRef.current.name ||
    current.description !== baselineRef.current.description ||
    current.goal !== baselineRef.current.goal;

  function confirmLeave(): boolean {
    if (!dirty || pending) {
      return true;
    }
    return window.confirm(
      'Des modifications non enregistrées seront perdues. Continuer ?',
    );
  }

  return (
    <form
      className="flex flex-col gap-5"
      noValidate
      onSubmit={handleSubmit(async (values) => {
        await onSubmit(values);
        baselineRef.current = getValues();
      })}
    >
      <label className="flex flex-col gap-1.5 text-sm" htmlFor="program-name">
        <span className="font-medium">Nom</span>
        <input
          id="program-name"
          type="text"
          autoComplete="off"
          className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 outline-none focus:border-[var(--primary)]"
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? 'program-name-error' : undefined}
          {...register('name')}
        />
        {errors.name ? (
          <span id="program-name-error" className="text-[var(--danger)]" role="alert">
            {errors.name.message}
          </span>
        ) : null}
      </label>

      <label
        className="flex flex-col gap-1.5 text-sm"
        htmlFor="program-description"
      >
        <span className="font-medium">Description</span>
        <textarea
          id="program-description"
          rows={4}
          className="rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 py-2 outline-none focus:border-[var(--primary)]"
          aria-invalid={Boolean(errors.description)}
          aria-describedby={
            errors.description ? 'program-description-error' : undefined
          }
          {...register('description')}
        />
        {errors.description ? (
          <span
            id="program-description-error"
            className="text-[var(--danger)]"
            role="alert"
          >
            {errors.description.message}
          </span>
        ) : null}
      </label>

      <label className="flex flex-col gap-1.5 text-sm" htmlFor="program-goal">
        <span className="font-medium">Objectif</span>
        <select
          id="program-goal"
          className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 outline-none focus:border-[var(--primary)]"
          aria-invalid={Boolean(errors.goal)}
          {...register('goal')}
        >
          {TRAINING_GOAL_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {errors.goal ? (
          <span className="text-[var(--danger)]" role="alert">
            {errors.goal.message}
          </span>
        ) : null}
      </label>

      {submitError ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {submitError}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <ButtonLink
          to={cancelTo}
          variant="secondary"
          className="w-full sm:w-auto"
          onClick={(event) => {
            if (!confirmLeave()) {
              event.preventDefault();
            }
          }}
        >
          Annuler
        </ButtonLink>
        <Button
          type="submit"
          className="w-full sm:w-auto"
          disabled={pending}
        >
          {pending ? 'Enregistrement…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
