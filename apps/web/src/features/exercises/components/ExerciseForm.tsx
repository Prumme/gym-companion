import type {
  EquipmentTypeReference,
  MuscleGroupReference,
} from '@gym-companion/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Button, ButtonLink } from '@/components/ui/button';

import { MEASUREMENT_TYPE_OPTIONS } from '../lib/exercise-labels';
import {
  EMPTY_EXERCISE_FORM_VALUES,
  exerciseFormSchema,
  isExerciseFormDirty,
  normalizeSecondaryMuscleGroups,
  type ExerciseFormValues,
} from '../lib/exercise-form';
import { EquipmentCompatibilityEditor } from './EquipmentCompatibilityEditor';
import {
  MuscleGroupSelector,
  SecondaryMuscleGroupSelector,
} from './MuscleGroupSelector';

type ExerciseFormProps = {
  mode: 'create' | 'edit';
  initialValues?: ExerciseFormValues;
  muscleGroups: MuscleGroupReference[];
  equipmentTypes: EquipmentTypeReference[];
  pending?: boolean;
  submitError?: string | null;
  cancelTo: string;
  onSubmit: (values: ExerciseFormValues) => Promise<void> | void;
};

export function ExerciseForm({
  mode,
  initialValues = EMPTY_EXERCISE_FORM_VALUES,
  muscleGroups,
  equipmentTypes,
  pending = false,
  submitError = null,
  cancelTo,
  onSubmit,
}: ExerciseFormProps) {
  const initializedRef = useRef(false);
  const baselineRef = useRef(initialValues);

  const form = useForm<ExerciseFormValues>({
    resolver: zodResolver(exerciseFormSchema),
    defaultValues: initialValues,
    mode: 'onSubmit',
  });

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
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

  const primaryMuscleGroupId = watch('primaryMuscleGroupId');
  const secondaryMuscleGroupIds = watch('secondaryMuscleGroupIds');
  const defaultEquipmentTypeId = watch('defaultEquipmentTypeId');
  const instructions = watch('instructions');
  const currentValues = watch();

  useEffect(() => {
    const next = normalizeSecondaryMuscleGroups(
      primaryMuscleGroupId,
      secondaryMuscleGroupIds,
    );
    if (
      next.length !== secondaryMuscleGroupIds.length ||
      next.some((id, index) => id !== secondaryMuscleGroupIds[index])
    ) {
      setValue('secondaryMuscleGroupIds', next, { shouldDirty: true });
    }
  }, [primaryMuscleGroupId, secondaryMuscleGroupIds, setValue]);

  const dirty = isExerciseFormDirty(currentValues, baselineRef.current);

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
      className="flex flex-col gap-6"
      noValidate
      onSubmit={handleSubmit(async (values) => {
        await onSubmit(values);
        baselineRef.current = getValues();
      })}
    >
      <section className="flex flex-col gap-4">
        <h2 className="section-title">Identité</h2>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="exercise-name">
            Nom <span className="text-[var(--danger)]">*</span>
          </label>
          <input
            id="exercise-name"
            type="text"
            maxLength={120}
            className="min-h-11 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'exercise-name-error' : undefined}
            disabled={pending}
            {...register('name')}
          />
          {errors.name ? (
            <p
              id="exercise-name-error"
              className="text-xs text-[var(--danger)]"
              role="alert"
            >
              {errors.name.message}
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Controller
            control={control}
            name="primaryMuscleGroupId"
            render={({ field }) => (
              <MuscleGroupSelector
                id="primary-muscle"
                label="Muscle principal"
                required
                muscleGroups={muscleGroups}
                value={field.value}
                onChange={field.onChange}
                error={errors.primaryMuscleGroupId?.message}
                disabled={pending}
              />
            )}
          />

          <Controller
            control={control}
            name="secondaryMuscleGroupIds"
            render={({ field }) => (
              <SecondaryMuscleGroupSelector
                muscleGroups={muscleGroups}
                primaryMuscleGroupId={primaryMuscleGroupId}
                value={field.value}
                onChange={field.onChange}
                error={errors.secondaryMuscleGroupIds?.message}
                disabled={pending}
              />
            )}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="section-title">Mesure</h2>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="measurement-type">
            Type de mesure <span className="text-[var(--danger)]">*</span>
          </label>
          <select
            id="measurement-type"
            className="min-h-11 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
            disabled={pending}
            {...register('measurementType')}
          >
            {MEASUREMENT_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.measurementType ? (
            <p className="text-xs text-[var(--danger)]" role="alert">
              {errors.measurementType.message}
            </p>
          ) : null}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="section-title">Équipement</h2>
        <Controller
          control={control}
          name="compatibleEquipmentTypes"
          render={({ field }) => (
            <EquipmentCompatibilityEditor
              equipmentTypes={equipmentTypes}
              value={field.value}
              defaultEquipmentTypeId={defaultEquipmentTypeId}
              disabled={pending}
              error={errors.compatibleEquipmentTypes?.message}
              defaultError={errors.defaultEquipmentTypeId?.message}
              onChange={(compatible, nextDefault) => {
                field.onChange(compatible);
                setValue('defaultEquipmentTypeId', nextDefault, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }}
            />
          )}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="section-title">Paramètres</h2>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="default-rest">
            Repos par défaut (secondes)
          </label>
          <p id="default-rest-desc" className="text-xs text-[var(--muted-foreground)]">
            Laisse vide si aucun repos par défaut n’est nécessaire.
          </p>
          <input
            id="default-rest"
            type="number"
            inputMode="numeric"
            min={0}
            max={3600}
            step={1}
            className="min-h-11 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm md:max-w-xs"
            aria-describedby="default-rest-desc"
            aria-invalid={Boolean(errors.defaultRestSeconds)}
            disabled={pending}
            {...register('defaultRestSeconds')}
          />
          {errors.defaultRestSeconds ? (
            <p className="text-xs text-[var(--danger)]" role="alert">
              {errors.defaultRestSeconds.message}
            </p>
          ) : null}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="section-title">Détails</h2>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="instructions">
            Instructions
          </label>
          <textarea
            id="instructions"
            rows={5}
            maxLength={4000}
            className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            aria-invalid={Boolean(errors.instructions)}
            disabled={pending}
            {...register('instructions')}
          />
          <p className="text-xs text-[var(--muted-foreground)]">
            {instructions.length}/4000
          </p>
          {errors.instructions ? (
            <p className="text-xs text-[var(--danger)]" role="alert">
              {errors.instructions.message}
            </p>
          ) : null}
        </div>
      </section>

      {submitError ? (
        <div
          className="rounded-[var(--radius)] border border-red-200 bg-red-50 p-3"
          role="alert"
        >
          <p className="text-sm text-[var(--danger)]">{submitError}</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <ButtonLink
          to={cancelTo}
          variant="secondary"
          onClick={(event) => {
            if (!confirmLeave()) {
              event.preventDefault();
            }
          }}
        >
          Annuler
        </ButtonLink>
        <Button type="submit" disabled={pending}>
          {pending
            ? mode === 'create'
              ? 'Création…'
              : 'Enregistrement…'
            : mode === 'create'
              ? 'Créer l’exercice'
              : 'Enregistrer'}
        </Button>
      </div>
    </form>
  );
}
