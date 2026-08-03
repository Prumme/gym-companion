import type { ExerciseUserPreference } from '@gym-companion/shared';
import {
  updateExercisePreferenceSchema,
  type UpdateExercisePreferenceInput,
} from '@gym-companion/validation';

export const DEFAULT_EXERCISE_USER_PREFERENCE: ExerciseUserPreference = {
  isFavorite: false,
  isExcludedFromSuggestions: false,
  preferredEquipmentType: null,
  restSecondsOverride: null,
};

export function hasCustomExercisePreference(
  preference: ExerciseUserPreference,
): boolean {
  return (
    preference.isFavorite ||
    preference.isExcludedFromSuggestions ||
    preference.preferredEquipmentType !== null ||
    preference.restSecondsOverride !== null
  );
}

export function preferenceToUpdateInput(
  preference: ExerciseUserPreference,
  overrides: Partial<UpdateExercisePreferenceInput> = {},
): UpdateExercisePreferenceInput {
  return updateExercisePreferenceSchema.parse({
    isFavorite: preference.isFavorite,
    isExcludedFromSuggestions: preference.isExcludedFromSuggestions,
    preferredEquipmentTypeId: preference.preferredEquipmentType?.id ?? null,
    restSecondsOverride: preference.restSecondsOverride,
    ...overrides,
  });
}

export type ExercisePreferenceFormValues = {
  isFavorite: boolean;
  isExcludedFromSuggestions: boolean;
  preferredEquipmentTypeId: string;
  restSecondsOverride: string;
};

export function preferenceToFormValues(
  preference: ExerciseUserPreference,
): ExercisePreferenceFormValues {
  return {
    isFavorite: preference.isFavorite,
    isExcludedFromSuggestions: preference.isExcludedFromSuggestions,
    preferredEquipmentTypeId: preference.preferredEquipmentType?.id ?? '',
    restSecondsOverride:
      preference.restSecondsOverride != null
        ? String(preference.restSecondsOverride)
        : '',
  };
}

/** Transforme le formulaire vers le payload API (valeur vide → null). */
export function preferenceFormToPayload(
  values: ExercisePreferenceFormValues,
): UpdateExercisePreferenceInput {
  const trimmedRest = values.restSecondsOverride.trim();
  const restSecondsOverride =
    trimmedRest.length === 0 ? null : Number(trimmedRest);

  return updateExercisePreferenceSchema.parse({
    isFavorite: values.isFavorite,
    isExcludedFromSuggestions: values.isExcludedFromSuggestions,
    preferredEquipmentTypeId:
      values.preferredEquipmentTypeId.trim() === ''
        ? null
        : values.preferredEquipmentTypeId,
    restSecondsOverride,
  });
}
