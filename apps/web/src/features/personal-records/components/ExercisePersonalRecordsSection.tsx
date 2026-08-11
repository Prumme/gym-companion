import type { PersonalRecord } from '@gym-companion/shared';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { getApiErrorMessage } from '@/lib/api/client';

import { exercisePersonalRecordsQueryOptions } from '../api/personal-record-query-options';
import { PersonalRecordRow } from './PersonalRecordRow';

type ExercisePersonalRecordsSectionProps = {
  exerciseId: string;
  /** Masque le CTA progression (déjà sur la page détail). */
  hideProgressCta?: boolean;
};

export function ExercisePersonalRecordsSection({
  exerciseId,
  hideProgressCta = false,
}: ExercisePersonalRecordsSectionProps) {
  const recordsQuery = useQuery(exercisePersonalRecordsQueryOptions(exerciseId));

  return (
    <section aria-labelledby="exercise-personal-records-heading">
      <h2
        id="exercise-personal-records-heading"
        className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]"
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
        <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {recordsQuery.data.map((record: PersonalRecord) => (
            <PersonalRecordRow
              key={`${record.recordType}-${record.source.workoutSetId}`}
              record={record}
              showExerciseName={false}
            />
          ))}
        </ul>
      ) : null}

      {!hideProgressCta ? (
        <div className="mt-3">
          <Link
            to={`/progress/exercises/${exerciseId}`}
            className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            Voir ma progression
          </Link>
        </div>
      ) : null}
    </section>
  );
}
