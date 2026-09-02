import type {
  ExerciseMeasurementType,
  LastWorkingSetCue,
  PersonalRecord,
} from '@gym-companion/shared';
import { useQuery } from '@tanstack/react-query';

import { listPersonalRecords } from '@/features/personal-records/api/personal-records-api';
import { personalRecordQueryKeys } from '@/features/personal-records/api/personal-record-query-keys';
import { lastWorkingSetsQueryOptions } from '@/features/progress/api/progress-query-options';

const WEIGHT_RECORD_MEASUREMENTS = new Set<ExerciseMeasurementType>([
  'WEIGHT_REPS',
  'WEIGHT_DURATION',
]);

export function supportsWeightLoadCue(
  measurementType: ExerciseMeasurementType,
): boolean {
  return WEIGHT_RECORD_MEASUREMENTS.has(measurementType);
}

export function formatLoadCue(
  weightKg: number | null | undefined,
  reps: number | null | undefined,
): string | null {
  if (weightKg == null) {
    return null;
  }
  if (reps != null) {
    return `${weightKg} kg × ${reps}`;
  }
  return `${weightKg} kg`;
}

export function pickMaxWeightRecord(
  records: PersonalRecord[],
  exerciseId: string,
  equipmentId: string | null,
): PersonalRecord | null {
  return (
    records.find(
      (record) =>
        record.recordType === 'MAX_WEIGHT' &&
        record.exerciseId === exerciseId &&
        record.equipment.id === equipmentId,
    ) ?? null
  );
}

export function useActiveWorkoutLoadCues(exerciseIds: string[]) {
  const ids = [...new Set(exerciseIds.filter(Boolean))].sort();

  const recordsQuery = useQuery({
    queryKey: personalRecordQueryKeys.list({
      recordType: 'MAX_WEIGHT',
      limit: 100,
    }),
    queryFn: () =>
      listPersonalRecords({
        recordType: 'MAX_WEIGHT',
        limit: 100,
      }),
    enabled: ids.length > 0,
    staleTime: 60_000,
  });

  const lastSetsQuery = useQuery({
    ...lastWorkingSetsQueryOptions(ids),
    enabled: ids.length > 0,
  });

  const lastByExercise = new Map<string, LastWorkingSetCue>();
  for (const cue of lastSetsQuery.data ?? []) {
    lastByExercise.set(cue.exerciseId, cue);
  }

  return {
    records: recordsQuery.data?.data ?? [],
    lastByExercise,
    isFetched: recordsQuery.isFetched && lastSetsQuery.isFetched,
  };
}
