import type {
  LastWorkingSetCue,
  PersonalRecord,
  WorkoutSessionExerciseDetail,
} from '@gym-companion/shared';
import { History } from 'lucide-react';

import { ButtonLink } from '@/components/ui/button';

import {
  formatLoadCue,
  pickMaxWeightRecord,
  supportsWeightLoadCue,
} from '../hooks/use-active-workout-load-cues';

type ExerciseLoadCuesProps = {
  exercise: WorkoutSessionExerciseDetail;
  records: PersonalRecord[];
  lastSet: LastWorkingSetCue | undefined;
  ready: boolean;
};

export function ExerciseLoadCues({
  exercise,
  records,
  lastSet,
  ready,
}: ExerciseLoadCuesProps) {
  const catalogId = exercise.sourceExerciseId;
  const showWeightCues =
    ready && catalogId != null && supportsWeightLoadCue(exercise.measurementType);
  const record = showWeightCues
    ? pickMaxWeightRecord(records, catalogId, exercise.equipment.id)
    : null;
  const recordLabel = record
    ? formatLoadCue(record.value, record.context.reps)
    : null;
  const lastLabel =
    showWeightCues && lastSet
      ? formatLoadCue(lastSet.actualWeightKg, lastSet.actualReps)
      : null;

  return (
    <div className="flex flex-col gap-2">
      {showWeightCues ? (
        <div className="text-xs text-[var(--muted)]">
          <p className="font-semibold uppercase tracking-wide">Repères</p>
          {lastLabel ? (
            <p className="mt-0.5">
              Dernière fois :{' '}
              <span className="tabular-nums text-[var(--foreground)]">
                {lastLabel}
              </span>
            </p>
          ) : null}
          <p className={lastLabel ? 'mt-0.5' : 'mt-0.5'}>
            Record :{' '}
            <span className="tabular-nums text-[var(--foreground)]">
              {recordLabel ?? 'Aucun record'}
            </span>
          </p>
        </div>
      ) : null}

      {catalogId ? (
        <ButtonLink
          to={`/progress/exercises/${catalogId}`}
          variant="ghost"
          className="h-11 min-h-11 w-fit gap-2 px-2 text-sm font-medium"
          state={{ from: 'workout' }}
        >
          <History className="size-4" aria-hidden="true" />
          Voir l’historique
        </ButtonLink>
      ) : null}
    </div>
  );
}
