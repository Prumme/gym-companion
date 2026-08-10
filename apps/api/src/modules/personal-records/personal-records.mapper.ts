import type {
  ExerciseMeasurementType,
  PersonalRecord,
  WorkoutSetType,
} from '@gym-companion/shared';
import type {
  PersonalRecordCandidate,
  PersonalRecordType,
} from '@gym-companion/validation';
import { getPersonalRecordPrincipalValue } from '@gym-companion/validation';

export type CatalogExerciseInfo = {
  id: string;
  name: string;
  measurementType: ExerciseMeasurementType;
  archivedAt: Date | null;
};

export function toPersonalRecord(
  recordType: PersonalRecordType,
  candidate: PersonalRecordCandidate,
  catalog: CatalogExerciseInfo | null,
): PersonalRecord {
  const value = getPersonalRecordPrincipalValue(recordType, candidate);
  if (value == null) {
    throw new Error('PERSONAL_RECORD_MISSING_PRINCIPAL');
  }

  return {
    exerciseId: candidate.sourceExerciseId,
    exercise: {
      id: candidate.sourceExerciseId,
      name: candidate.exerciseNameSnapshot,
      measurementType: candidate.measurementTypeSnapshot as ExerciseMeasurementType,
      archived: catalog ? catalog.archivedAt != null : null,
    },
    equipment: {
      id: candidate.equipmentTypeId,
      name: candidate.equipmentNameSnapshot,
    },
    recordType,
    value,
    context: {
      weightKg: candidate.actualWeightKg,
      reps: candidate.actualReps,
      durationSeconds: candidate.actualDurationSeconds,
      distanceMeters: candidate.actualDistanceMeters,
      rir: candidate.actualRir,
      rpe: candidate.actualRpe,
      reachedFailure: candidate.reachedFailure,
      setType: candidate.setType as WorkoutSetType,
    },
    achievedOn: candidate.achievedOn,
    achievedAt: candidate.achievedAt,
    source: {
      workoutSessionId: candidate.workoutSessionId,
      workoutSessionExerciseId: candidate.workoutSessionExerciseId,
      workoutSetId: candidate.workoutSetId,
    },
  };
}
