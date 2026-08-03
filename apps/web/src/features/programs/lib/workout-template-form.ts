import type { WorkoutTemplateDetail } from '@gym-companion/shared';
import {
  createWorkoutTemplateSchema,
  type CreateWorkoutTemplateInput,
  type UpdateWorkoutTemplateInput,
} from '@gym-companion/validation';
import { z } from 'zod';

export type WorkoutTemplateFormValues = {
  name: string;
  description: string;
  estimatedDurationMinutes: string;
};

export const EMPTY_WORKOUT_TEMPLATE_FORM_VALUES: WorkoutTemplateFormValues = {
  name: '',
  description: '',
  estimatedDurationMinutes: '',
};

export const workoutTemplateFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Le nom est requis.')
    .max(120, 'Le nom ne peut pas dépasser 120 caractères.'),
  description: z.string().max(2000, 'La description est trop longue.'),
  estimatedDurationMinutes: z
    .string()
    .refine(
      (value) => value.trim() === '' || /^\d+$/.test(value.trim()),
      'La durée doit être un entier.',
    )
    .refine((value) => {
      if (value.trim() === '') {
        return true;
      }
      const parsed = Number(value.trim());
      return parsed >= 1 && parsed <= 600;
    }, 'La durée doit être entre 1 et 600 minutes.'),
});

export function detailToWorkoutTemplateFormValues(
  detail: Pick<
    WorkoutTemplateDetail,
    'name' | 'description' | 'estimatedDurationMinutes'
  >,
): WorkoutTemplateFormValues {
  return {
    name: detail.name,
    description: detail.description ?? '',
    estimatedDurationMinutes:
      detail.estimatedDurationMinutes != null
        ? String(detail.estimatedDurationMinutes)
        : '',
  };
}

export function workoutTemplateFormToCreatePayload(
  values: WorkoutTemplateFormValues,
): CreateWorkoutTemplateInput {
  const duration = values.estimatedDurationMinutes.trim();
  return createWorkoutTemplateSchema.parse({
    name: values.name,
    description:
      values.description.trim() === '' ? null : values.description.trim(),
    estimatedDurationMinutes: duration === '' ? null : Number(duration),
  });
}

export function workoutTemplateFormToUpdatePayload(
  values: WorkoutTemplateFormValues,
): UpdateWorkoutTemplateInput {
  return workoutTemplateFormToCreatePayload(values);
}
