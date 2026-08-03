import type {
  ExerciseCompatibleEquipment,
  ExerciseUserPreference,
} from '@gym-companion/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { UpdateExercisePreferenceInput } from '@gym-companion/validation';

import { Button } from '@/components/ui/button';

import {
  preferenceFormToPayload,
  preferenceToFormValues,
  type ExercisePreferenceFormValues,
} from '../lib/exercise-preference';

const preferenceFormSchema = z.object({
  isFavorite: z.boolean(),
  isExcludedFromSuggestions: z.boolean(),
  preferredEquipmentTypeId: z.string(),
  restSecondsOverride: z
    .string()
    .refine(
      (value) => value.trim() === '' || /^\d+$/.test(value.trim()),
      'Le repos doit être un entier.',
    )
    .refine((value) => {
      if (value.trim() === '') {
        return true;
      }
      const parsed = Number(value.trim());
      return parsed >= 0 && parsed <= 1800;
    }, 'Le repos doit être entre 0 et 1800 secondes.'),
});

type ExercisePreferenceFormProps = {
  preference: ExerciseUserPreference;
  compatibleEquipment: ExerciseCompatibleEquipment[];
  pending?: boolean;
  submitError?: string | null;
  onSubmit: (payload: UpdateExercisePreferenceInput) => Promise<void> | void;
  onCancel: () => void;
};

export function ExercisePreferenceForm({
  preference,
  compatibleEquipment,
  pending = false,
  submitError,
  onSubmit,
  onCancel,
}: ExercisePreferenceFormProps) {
  const form = useForm<ExercisePreferenceFormValues>({
    resolver: zodResolver(preferenceFormSchema),
    defaultValues: preferenceToFormValues(preference),
  });

  useEffect(() => {
    form.reset(preferenceToFormValues(preference));
  }, [preference, form]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={handleSubmit(async (values) => {
        await onSubmit(preferenceFormToPayload(values));
      })}
      noValidate
    >
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" className="size-4" {...register('isFavorite')} />
        <span>Favori</span>
      </label>

      <div className="flex flex-col gap-1.5">
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 size-4"
            {...register('isExcludedFromSuggestions')}
          />
          <span>
            Ne pas proposer automatiquement cet exercice
            <span className="mt-1 block text-xs text-[var(--muted)]">
              L’exercice restera visible dans le catalogue et pourra toujours être
              sélectionné manuellement.
            </span>
          </span>
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-sm" htmlFor="preferred-equipment">
        <span className="font-medium">Équipement préféré</span>
        <select
          id="preferred-equipment"
          className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 outline-none focus:border-[var(--primary)]"
          {...register('preferredEquipmentTypeId')}
        >
          <option value="">Aucun équipement préféré</option>
          {compatibleEquipment.map((item) => (
            <option key={item.equipmentType.id} value={item.equipmentType.id}>
              {item.equipmentType.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5 text-sm" htmlFor="rest-override">
        <span className="font-medium">Repos personnel (secondes)</span>
        <input
          id="rest-override"
          type="text"
          inputMode="numeric"
          className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 outline-none focus:border-[var(--primary)]"
          placeholder="Ex. 90"
          aria-invalid={Boolean(errors.restSecondsOverride)}
          aria-describedby={
            errors.restSecondsOverride ? 'rest-override-error' : 'rest-override-help'
          }
          {...register('restSecondsOverride')}
        />
        <span id="rest-override-help" className="text-xs text-[var(--muted)]">
          Laisse vide pour utiliser le repos défini par l’exercice ou le programme.
        </span>
        {errors.restSecondsOverride ? (
          <span id="rest-override-error" className="text-[var(--danger)]" role="alert">
            {errors.restSecondsOverride.message}
          </span>
        ) : null}
      </label>

      {submitError ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {submitError}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" className="flex-1" disabled={pending} aria-busy={pending}>
          {pending ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          disabled={pending}
          onClick={onCancel}
        >
          Annuler
        </Button>
      </div>
    </form>
  );
}
