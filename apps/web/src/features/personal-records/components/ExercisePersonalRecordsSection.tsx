import type { PersonalRecord } from '@gym-companion/shared';
import { useQuery } from '@tanstack/react-query';

import { getApiErrorMessage } from '@/lib/api/client';

import { exercisePersonalRecordsQueryOptions } from '../api/personal-record-query-options';
import { PersonalRecordCard } from './PersonalRecordCard';

type ExercisePersonalRecordsSectionProps = {
  exerciseId: string;
};

export function ExercisePersonalRecordsSection({
  exerciseId,
}: ExercisePersonalRecordsSectionProps) {
  const recordsQuery = useQuery(exercisePersonalRecordsQueryOptions(exerciseId));

  return (
    <section
      className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4"
      aria-labelledby="exercise-personal-records-heading"
    >
      <h2
        id="exercise-personal-records-heading"
        className="mb-3 text-sm font-semibold tracking-wide text-[var(--muted)] uppercase"
      >
        Records personnels
      </h2>

      {recordsQuery.isLoading ? (
        <p className="text-sm text-[var(--muted)]" aria-busy="true">
          Chargement des records…
        </p>
      ) : null}

      {recordsQuery.isError ? (
        <div role="alert">
          <p className="text-sm text-[var(--danger)]">
            {getApiErrorMessage(
              recordsQuery.error,
              'Impossible de charger les records.',
            )}
          </p>
          <button
            type="button"
            className="mt-2 text-sm font-semibold text-[var(--primary)] underline-offset-2 hover:underline"
            onClick={() => void recordsQuery.refetch()}
          >
            Réessayer
          </button>
        </div>
      ) : null}

      {recordsQuery.isSuccess && recordsQuery.data.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          Aucun record enregistré pour cet exercice.
        </p>
      ) : null}

      {recordsQuery.isSuccess && recordsQuery.data.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {recordsQuery.data.map((record: PersonalRecord) => (
            <li key={`${record.recordType}-${record.source.workoutSetId}`}>
              <PersonalRecordCard record={record} showExerciseLink={false} />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
