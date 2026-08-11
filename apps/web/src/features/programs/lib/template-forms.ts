import type {
  ExerciseDetail,
  ExerciseListItem,
  ExerciseMeasurementType,
  WorkoutTemplateExerciseDetail,
  WorkoutTemplateSetTarget,
} from '@gym-companion/shared';
import type {
  AddWorkoutTemplateExerciseInput,
  CreateWorkoutTemplateSetInput,
  UpdateWorkoutTemplateExerciseInput,
  UpdateWorkoutTemplateSetInput,
} from '@gym-companion/validation';
import { z } from 'zod';

export type TemplateExerciseFormValues = {
  equipmentTypeId: string;
  restSecondsOverride: string;
  notes: string;
};

export function getInitialEquipmentTypeId(
  exercise: Pick<
    ExerciseDetail | ExerciseListItem,
    'defaultEquipmentType' | 'userPreference'
  > & {
    compatibleEquipmentTypes?: Array<{
      equipmentType: { id: string };
      isPreferred?: boolean;
    }>;
  },
): string {
  const preferred = exercise.userPreference?.preferredEquipmentType?.id;
  const compatibleIds = new Set(
    (exercise.compatibleEquipmentTypes ?? []).map(
      (item) => item.equipmentType.id,
    ),
  );
  if (preferred && (compatibleIds.size === 0 || compatibleIds.has(preferred))) {
    return preferred;
  }
  if (exercise.defaultEquipmentType?.id) {
    return exercise.defaultEquipmentType.id;
  }
  const preferredCompatible = exercise.compatibleEquipmentTypes?.find(
    (item) => item.isPreferred,
  );
  return preferredCompatible?.equipmentType.id ?? '';
}

export function getInitialRestSeconds(
  exercise: Pick<
    ExerciseDetail | ExerciseListItem,
    'defaultRestSeconds' | 'userPreference'
  >,
): string {
  if (exercise.userPreference?.restSecondsOverride != null) {
    return String(exercise.userPreference.restSecondsOverride);
  }
  if (exercise.defaultRestSeconds != null) {
    return String(exercise.defaultRestSeconds);
  }
  return '';
}

export function buildAddExerciseDefaults(
  exercise: ExerciseDetail | (ExerciseListItem & {
    compatibleEquipmentTypes?: ExerciseDetail['compatibleEquipmentTypes'];
  }),
): TemplateExerciseFormValues {
  return {
    equipmentTypeId: getInitialEquipmentTypeId(exercise),
    restSecondsOverride: getInitialRestSeconds(exercise),
    notes: '',
  };
}

export function detailToTemplateExerciseFormValues(
  detail: WorkoutTemplateExerciseDetail,
): TemplateExerciseFormValues {
  return {
    equipmentTypeId: detail.equipmentType?.id ?? '',
    restSecondsOverride:
      detail.restSecondsOverride != null ? String(detail.restSecondsOverride) : '',
    notes: detail.notes ?? '',
  };
}

export const templateExerciseFormSchema = z.object({
  equipmentTypeId: z.string(),
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
  notes: z.string().max(2000),
});

export function templateExerciseFormToAddPayload(
  exerciseId: string,
  values: TemplateExerciseFormValues,
): AddWorkoutTemplateExerciseInput {
  const rest = values.restSecondsOverride.trim();
  return {
    exerciseId,
    equipmentTypeId: values.equipmentTypeId === '' ? null : values.equipmentTypeId,
    restSecondsOverride: rest === '' ? null : Number(rest),
    notes: values.notes.trim() === '' ? null : values.notes.trim(),
  };
}

export function templateExerciseFormToUpdatePayload(
  values: TemplateExerciseFormValues,
): UpdateWorkoutTemplateExerciseInput {
  const rest = values.restSecondsOverride.trim();
  return {
    equipmentTypeId: values.equipmentTypeId === '' ? null : values.equipmentTypeId,
    restSecondsOverride: rest === '' ? null : Number(rest),
    notes: values.notes.trim() === '' ? null : values.notes.trim(),
  };
}

export type TemplateSetFormValues = {
  setType: CreateWorkoutTemplateSetInput['setType'];
  targetRepMin: string;
  targetRepMax: string;
  targetDurationMinutes: string;
  targetDurationSeconds: string;
  targetDistanceMeters: string;
  targetWeightKg: string;
  targetIntensityPercent: string;
  targetRir: string;
  targetRpe: string;
  restSeconds: string;
};

export function emptySetFormValues(
  measurementType: ExerciseMeasurementType,
): TemplateSetFormValues {
  const needsReps = [
    'WEIGHT_REPS',
    'BODYWEIGHT_REPS',
    'ASSISTED_BODYWEIGHT_REPS',
    'REPS_ONLY',
  ].includes(measurementType);
  return {
    setType: 'WORKING',
    targetRepMin: needsReps ? '8' : '',
    targetRepMax: needsReps ? '10' : '',
    targetDurationMinutes: '',
    targetDurationSeconds: measurementType === 'DURATION' || measurementType === 'WEIGHT_DURATION' ? '30' : '',
    targetDistanceMeters: measurementType === 'DISTANCE_DURATION' ? '1000' : '',
    targetWeightKg: '',
    targetIntensityPercent: '',
    targetRir: '',
    targetRpe: '',
    restSeconds: '90',
  };
}

export function setDetailToFormValues(
  set: WorkoutTemplateSetTarget,
): TemplateSetFormValues {
  const total = set.targetDurationSeconds ?? 0;
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return {
    setType: set.setType,
    targetRepMin: set.targetRepMin != null ? String(set.targetRepMin) : '',
    targetRepMax: set.targetRepMax != null ? String(set.targetRepMax) : '',
    targetDurationMinutes: set.targetDurationSeconds != null ? String(minutes) : '',
    targetDurationSeconds: set.targetDurationSeconds != null ? String(seconds) : '',
    targetDistanceMeters:
      set.targetDistanceMeters != null ? String(set.targetDistanceMeters) : '',
    targetWeightKg: set.targetWeightKg != null ? String(set.targetWeightKg) : '',
    targetIntensityPercent:
      set.targetIntensityPercent != null ? String(set.targetIntensityPercent) : '',
    targetRir: set.targetRir != null ? String(set.targetRir) : '',
    targetRpe: set.targetRpe != null ? String(set.targetRpe) : '',
    restSeconds: set.restSeconds != null ? String(set.restSeconds) : '',
  };
}

export function durationPartsToSeconds(
  minutesRaw: string,
  secondsRaw: string,
): number | null {
  const minutes = minutesRaw.trim() === '' ? 0 : Number(minutesRaw.trim());
  const seconds = secondsRaw.trim() === '' ? 0 : Number(secondsRaw.trim());
  if (
    !Number.isInteger(minutes) ||
    !Number.isInteger(seconds) ||
    minutes < 0 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null;
  }
  if (minutesRaw.trim() === '' && secondsRaw.trim() === '') {
    return null;
  }
  const total = minutes * 60 + seconds;
  return total > 0 ? total : null;
}

export function setFormToPayload(
  values: TemplateSetFormValues,
): CreateWorkoutTemplateSetInput {
  const parseOptionalInt = (raw: string) =>
    raw.trim() === '' ? null : Number(raw.trim());
  const parseOptionalNumber = (raw: string) =>
    raw.trim() === '' ? null : Number(raw.trim());

  return {
    setType: values.setType,
    targetRepMin: parseOptionalInt(values.targetRepMin),
    targetRepMax: parseOptionalInt(values.targetRepMax),
    targetDurationSeconds: durationPartsToSeconds(
      values.targetDurationMinutes,
      values.targetDurationSeconds,
    ),
    targetDistanceMeters: parseOptionalNumber(values.targetDistanceMeters),
    targetWeightKg: parseOptionalNumber(values.targetWeightKg),
    targetIntensityPercent: parseOptionalNumber(values.targetIntensityPercent),
    targetRir: parseOptionalInt(values.targetRir),
    targetRpe: parseOptionalNumber(values.targetRpe),
    restSeconds: parseOptionalInt(values.restSeconds),
  };
}

export function setFormToUpdatePayload(
  values: TemplateSetFormValues,
): UpdateWorkoutTemplateSetInput {
  return setFormToPayload(values);
}

export function duplicateSetFormValues(
  set: WorkoutTemplateSetTarget,
): TemplateSetFormValues {
  return setDetailToFormValues(set);
}

export function formatSetSummary(set: WorkoutTemplateSetTarget): string {
  const parts: string[] = [];
  if (set.targetRepMin != null && set.targetRepMax != null) {
    parts.push(
      set.targetRepMin === set.targetRepMax
        ? `${set.targetRepMin} répétitions`
        : `${set.targetRepMin} à ${set.targetRepMax} répétitions`,
    );
  }
  if (set.targetDurationSeconds != null) {
    parts.push(`${set.targetDurationSeconds} s`);
  }
  if (set.targetDistanceMeters != null) {
    parts.push(`${set.targetDistanceMeters} m`);
  }
  if (set.targetWeightKg != null) {
    parts.push(`${set.targetWeightKg} kg`);
  }
  if (set.targetRir != null) {
    parts.push(`RIR ${set.targetRir}`);
  }
  if (set.targetRpe != null) {
    parts.push(`RPE ${set.targetRpe}`);
  }
  if (set.restSeconds != null) {
    parts.push(`repos ${set.restSeconds} s`);
  }
  return parts.join(' — ');
}

/** Résumé compact pour TargetSetRow (Program Builder). */
export function formatSetSummaryCompact(set: WorkoutTemplateSetTarget): {
  primary: string;
  secondary: string | null;
} {
  const primaryParts: string[] = [];
  if (set.targetRepMin != null && set.targetRepMax != null) {
    primaryParts.push(
      set.targetRepMin === set.targetRepMax
        ? `${set.targetRepMin} reps`
        : `${set.targetRepMin}–${set.targetRepMax} reps`,
    );
  }
  if (set.targetDurationSeconds != null) {
    primaryParts.push(`${set.targetDurationSeconds} s`);
  }
  if (set.targetDistanceMeters != null) {
    primaryParts.push(`${set.targetDistanceMeters} m`);
  }

  const secondaryParts: string[] = [];
  if (set.targetWeightKg != null) {
    secondaryParts.push(`${set.targetWeightKg} kg`);
  }
  if (set.targetRir != null) {
    secondaryParts.push(`RIR ${set.targetRir}`);
  }
  if (set.targetRpe != null) {
    secondaryParts.push(`RPE ${set.targetRpe}`);
  }
  if (set.targetIntensityPercent != null) {
    secondaryParts.push(`${set.targetIntensityPercent} %`);
  }

  // Prefer weight on primary row when no effort metric competing for secondary.
  if (set.targetWeightKg != null && secondaryParts.length === 1) {
    primaryParts.push(`${set.targetWeightKg} kg`);
    return {
      primary: primaryParts.join('  ') || '—',
      secondary: null,
    };
  }

  if (set.targetWeightKg != null) {
    // Keep weight visible on primary for WEIGHT_REPS density.
    primaryParts.push(`${set.targetWeightKg} kg`);
    const secondary = secondaryParts
      .filter((part) => !part.endsWith(' kg'))
      .join(' · ');
    return {
      primary: primaryParts.join('  ') || '—',
      secondary: secondary || null,
    };
  }

  return {
    primary: primaryParts.join('  ') || '—',
    secondary: secondaryParts.join(' · ') || null,
  };
}

export function compatibleEquipmentOptions(
  exercise: ExerciseDetail,
): Array<{ id: string; name: string }> {
  return exercise.compatibleEquipmentTypes.map((item) => ({
    id: item.equipmentType.id,
    name: item.equipmentType.name,
  }));
}

export function measurementNeedsReps(type: ExerciseMeasurementType): boolean {
  return [
    'WEIGHT_REPS',
    'BODYWEIGHT_REPS',
    'ASSISTED_BODYWEIGHT_REPS',
    'REPS_ONLY',
  ].includes(type);
}

export function measurementNeedsDuration(type: ExerciseMeasurementType): boolean {
  return type === 'DURATION' || type === 'WEIGHT_DURATION' || type === 'DISTANCE_DURATION';
}

export function measurementNeedsDistance(type: ExerciseMeasurementType): boolean {
  return type === 'DISTANCE_DURATION';
}

export function measurementNeedsWeight(type: ExerciseMeasurementType): boolean {
  return type === 'WEIGHT_REPS' || type === 'WEIGHT_DURATION';
}
