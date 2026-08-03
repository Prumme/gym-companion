import type {
  ExerciseDetail,
  ExerciseMeasurementType,
  ExercisePermissions,
} from '@gym-companion/shared';
import {
  createExerciseSchema,
  type CreateExerciseInput,
  type UpdateExerciseInput,
} from '@gym-companion/validation';
import { z } from 'zod';

export type CompatibleEquipmentFormValue = {
  equipmentTypeId: string;
  isPreferred: boolean;
  notes: string;
};

export type ExerciseFormValues = {
  name: string;
  primaryMuscleGroupId: string;
  secondaryMuscleGroupIds: string[];
  measurementType: ExerciseMeasurementType;
  /** Chaîne vide = aucun équipement par défaut (`null` côté API). */
  defaultEquipmentTypeId: string;
  compatibleEquipmentTypes: CompatibleEquipmentFormValue[];
  /** Chaîne vide = `null` côté API. */
  defaultRestSeconds: string;
  /** Chaîne vide = `null` côté API. */
  instructions: string;
};

export const EMPTY_EXERCISE_FORM_VALUES: ExerciseFormValues = {
  name: '',
  primaryMuscleGroupId: '',
  secondaryMuscleGroupIds: [],
  measurementType: 'WEIGHT_REPS',
  defaultEquipmentTypeId: '',
  compatibleEquipmentTypes: [],
  defaultRestSeconds: '',
  instructions: '',
};

/**
 * `defaultEquipmentTypeId` et `isPreferred` sont indépendants :
 * - `isPreferred` = équipement recommandé pour l’exercice (catalogue)
 * - `defaultEquipmentTypeId` = équipement présélectionné à l’usage
 * Les deux doivent appartenir à `compatibleEquipmentTypes`.
 */
export function detailToFormValues(detail: ExerciseDetail): ExerciseFormValues {
  return {
    name: detail.name,
    primaryMuscleGroupId: detail.primaryMuscleGroup.id,
    secondaryMuscleGroupIds: detail.secondaryMuscleGroups.map((item) => item.id),
    measurementType: detail.measurementType,
    defaultEquipmentTypeId: detail.defaultEquipmentType?.id ?? '',
    compatibleEquipmentTypes: detail.compatibleEquipmentTypes.map((item) => ({
      equipmentTypeId: item.equipmentType.id,
      isPreferred: item.isPreferred,
      notes: item.notes ?? '',
    })),
    defaultRestSeconds:
      detail.defaultRestSeconds != null ? String(detail.defaultRestSeconds) : '',
    instructions: detail.instructions ?? '',
  };
}

export function normalizeSecondaryMuscleGroups(
  primaryMuscleGroupId: string,
  secondaryMuscleGroupIds: string[],
): string[] {
  const unique = [...new Set(secondaryMuscleGroupIds)];
  if (!primaryMuscleGroupId) {
    return unique;
  }
  return unique.filter((id) => id !== primaryMuscleGroupId);
}

export function ensureSinglePreferred(
  items: CompatibleEquipmentFormValue[],
  preferredEquipmentTypeId?: string,
): CompatibleEquipmentFormValue[] {
  if (preferredEquipmentTypeId) {
    return items.map((item) => ({
      ...item,
      isPreferred: item.equipmentTypeId === preferredEquipmentTypeId,
    }));
  }

  let keptPreferred = false;
  return items.map((item) => {
    if (!item.isPreferred) {
      return item;
    }
    if (!keptPreferred) {
      keptPreferred = true;
      return item;
    }
    return { ...item, isPreferred: false };
  });
}

export function reconcileDefaultEquipment(
  defaultEquipmentTypeId: string,
  compatibleEquipmentTypeIds: string[],
): string {
  if (!defaultEquipmentTypeId) {
    return '';
  }
  return compatibleEquipmentTypeIds.includes(defaultEquipmentTypeId)
    ? defaultEquipmentTypeId
    : '';
}

export function removeCompatibleEquipment(
  values: ExerciseFormValues,
  equipmentTypeId: string,
): ExerciseFormValues {
  const compatibleEquipmentTypes = values.compatibleEquipmentTypes.filter(
    (item) => item.equipmentTypeId !== equipmentTypeId,
  );
  return {
    ...values,
    compatibleEquipmentTypes,
    defaultEquipmentTypeId: reconcileDefaultEquipment(
      values.defaultEquipmentTypeId,
      compatibleEquipmentTypes.map((item) => item.equipmentTypeId),
    ),
  };
}

function normalizeForCompare(values: ExerciseFormValues) {
  return {
    name: values.name.trim(),
    primaryMuscleGroupId: values.primaryMuscleGroupId,
    secondaryMuscleGroupIds: [...values.secondaryMuscleGroupIds].sort(),
    measurementType: values.measurementType,
    defaultEquipmentTypeId: values.defaultEquipmentTypeId,
    compatibleEquipmentTypes: [...values.compatibleEquipmentTypes]
      .map((item) => ({
        equipmentTypeId: item.equipmentTypeId,
        isPreferred: item.isPreferred,
        notes: item.notes.trim(),
      }))
      .sort((a, b) => a.equipmentTypeId.localeCompare(b.equipmentTypeId)),
    defaultRestSeconds: values.defaultRestSeconds.trim(),
    instructions: values.instructions.trim(),
  };
}

export function isExerciseFormDirty(
  current: ExerciseFormValues,
  initial: ExerciseFormValues,
): boolean {
  return (
    JSON.stringify(normalizeForCompare(current)) !==
    JSON.stringify(normalizeForCompare(initial))
  );
}

export function formValuesToCreatePayload(
  values: ExerciseFormValues,
): CreateExerciseInput {
  const secondaryMuscleGroupIds = normalizeSecondaryMuscleGroups(
    values.primaryMuscleGroupId,
    values.secondaryMuscleGroupIds,
  );
  const compatibleEquipmentTypes = ensureSinglePreferred(
    values.compatibleEquipmentTypes,
  ).map((item) => ({
    equipmentTypeId: item.equipmentTypeId,
    isPreferred: item.isPreferred,
    notes: item.notes.trim() === '' ? null : item.notes.trim(),
  }));
  const defaultEquipmentTypeId =
    reconcileDefaultEquipment(
      values.defaultEquipmentTypeId,
      compatibleEquipmentTypes.map((item) => item.equipmentTypeId),
    ) || null;
  const restRaw = values.defaultRestSeconds.trim();
  const instructionsRaw = values.instructions.trim();

  return createExerciseSchema.parse({
    name: values.name.trim(),
    primaryMuscleGroupId: values.primaryMuscleGroupId,
    secondaryMuscleGroupIds,
    measurementType: values.measurementType,
    defaultEquipmentTypeId,
    compatibleEquipmentTypes,
    defaultRestSeconds: restRaw === '' ? null : Number(restRaw),
    instructions: instructionsRaw === '' ? null : instructionsRaw,
  });
}

export function formValuesToUpdatePayload(
  values: ExerciseFormValues,
): UpdateExerciseInput {
  return formValuesToCreatePayload(values);
}

export const exerciseFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Le nom est requis.')
      .max(120, 'Le nom ne peut pas dépasser 120 caractères.'),
    primaryMuscleGroupId: z
      .string()
      .uuid('Sélectionne un groupe musculaire principal.'),
    secondaryMuscleGroupIds: z.array(z.string().uuid()),
    measurementType: z.enum([
      'WEIGHT_REPS',
      'BODYWEIGHT_REPS',
      'ASSISTED_BODYWEIGHT_REPS',
      'REPS_ONLY',
      'DURATION',
      'DISTANCE_DURATION',
      'WEIGHT_DURATION',
    ]),
    defaultEquipmentTypeId: z.string(),
    compatibleEquipmentTypes: z.array(
      z.object({
        equipmentTypeId: z.string().uuid(),
        isPreferred: z.boolean(),
        notes: z
          .string()
          .max(500, 'La note ne peut pas dépasser 500 caractères.'),
      }),
    ),
    defaultRestSeconds: z
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
        return parsed >= 0 && parsed <= 3600;
      }, 'Le repos doit être entre 0 et 3600 secondes.'),
    instructions: z
      .string()
      .max(4000, 'Les instructions ne peuvent pas dépasser 4000 caractères.'),
  })
  .superRefine((data, ctx) => {
    const secondary = data.secondaryMuscleGroupIds;
    if (new Set(secondary).size !== secondary.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['secondaryMuscleGroupIds'],
        message: 'Groupes musculaires secondaires en double.',
      });
    }
    if (
      data.primaryMuscleGroupId &&
      secondary.includes(data.primaryMuscleGroupId)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['secondaryMuscleGroupIds'],
        message: 'Le groupe principal ne peut pas être secondaire.',
      });
    }

    const equipmentIds = data.compatibleEquipmentTypes.map(
      (item) => item.equipmentTypeId,
    );
    if (new Set(equipmentIds).size !== equipmentIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['compatibleEquipmentTypes'],
        message: 'Types d’équipement compatibles en double.',
      });
    }

    const preferredCount = data.compatibleEquipmentTypes.filter(
      (item) => item.isPreferred,
    ).length;
    if (preferredCount > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['compatibleEquipmentTypes'],
        message: 'Un seul type d’équipement peut être recommandé.',
      });
    }

    if (
      data.defaultEquipmentTypeId &&
      !equipmentIds.includes(data.defaultEquipmentTypeId)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['defaultEquipmentTypeId'],
        message: 'L’équipement par défaut doit être compatible.',
      });
    }
  });

export function canEditExercise(permissions: ExercisePermissions): boolean {
  return permissions.canEdit;
}

export function canArchiveExercise(permissions: ExercisePermissions): boolean {
  return permissions.canArchive;
}

export function canRestoreExercise(permissions: ExercisePermissions): boolean {
  return permissions.canRestore;
}
