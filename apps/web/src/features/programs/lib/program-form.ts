import type { ProgramDetail, TrainingGoal } from '@gym-companion/shared';
import {
  createProgramSchema,
  type CreateProgramInput,
  type UpdateProgramInput,
} from '@gym-companion/validation';
import { z } from 'zod';

export type ProgramFormValues = {
  name: string;
  description: string;
  goal: TrainingGoal;
};

export const EMPTY_PROGRAM_FORM_VALUES: ProgramFormValues = {
  name: '',
  description: '',
  goal: 'GENERAL_FITNESS',
};

export const programFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Le nom est requis.')
    .max(120, 'Le nom ne peut pas dépasser 120 caractères.'),
  description: z.string().max(2000, 'La description est trop longue.'),
  goal: z.enum(['ENDURANCE', 'HYPERTROPHY', 'STRENGTH', 'GENERAL_FITNESS']),
});

export function detailToProgramFormValues(
  detail: Pick<ProgramDetail, 'name' | 'description' | 'goal'>,
): ProgramFormValues {
  return {
    name: detail.name,
    description: detail.description ?? '',
    goal: detail.goal,
  };
}

export function programFormToCreatePayload(
  values: ProgramFormValues,
): CreateProgramInput {
  return createProgramSchema.parse({
    name: values.name,
    description: values.description.trim() === '' ? null : values.description.trim(),
    goal: values.goal,
  });
}

export function programFormToUpdatePayload(
  values: ProgramFormValues,
): UpdateProgramInput {
  return programFormToCreatePayload(values);
}

export function parseIncludeArchivedParam(
  value: string | null,
): boolean {
  if (value == null || value === '') {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') {
    return true;
  }
  if (normalized === 'false' || normalized === '0') {
    return false;
  }
  return false;
}
