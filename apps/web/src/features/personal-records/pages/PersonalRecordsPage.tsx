import type { PersonalRecord } from '@gym-companion/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { Button, ButtonLink } from '@/components/ui/button';
import { getMe } from '@/features/profile/api/profile-api';
import { pendingTerminalLocalQueryOptions } from '@/features/workouts/api/workout-query-options';
import { getApiErrorMessage } from '@/lib/api/client';

import { personalRecordsInfiniteQueryOptions } from '../api/personal-record-query-options';
import { PersonalRecordCard } from '../components/PersonalRecordCard';

function groupRecordsByExercise(
  records: PersonalRecord[],
): Array<{ exerciseId: string; name: string; records: PersonalRecord[] }> {
  const order: string[] = [];
  const map = new Map<
    string,
    { exerciseId: string; name: string; records: PersonalRecord[] }
  >();
  for (const record of records) {
    const existing = map.get(record.exerciseId);
    if (!existing) {
      order.push(record.exerciseId);
      map.set(record.exerciseId, {
        exerciseId: record.exerciseId,
        name: record.exercise.name,
        records: [record],
      });
    } else {
      existing.records.push(record);
    }
  }
  return order.map((id) => map.get(id)!);
}

function PersonalRecordsSkeleton() {
  return (
    <ul className="flex flex-col gap-3" aria-busy="true" aria-label="Chargement">
      {Array.from({ length: 3 }).map((_, index) => (
        <li
          key={index}
          className="h-32 animate-pulse rounded-[var(--radius)] border border-[var(--border)] bg-slate-100"
        />
      ))}
    </ul>
  );
}

export function PersonalRecordsPage() {
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    staleTime: 60_000,
  });
  const userId = meQuery.data?.data.id ?? null;

  const listQuery = useInfiniteQuery(personalRecordsInfiniteQueryOptions({}));
  const pendingLocalQuery = useQuery(pendingTerminalLocalQueryOptions(userId));

  const records = useMemo(
    () => listQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [listQuery.data],
  );
  const groups = useMemo(() => groupRecordsByExercise(records), [records]);

  const hasPendingCompletedSync = useMemo(() => {
    const snapshots = pendingLocalQuery.data ?? [];
    return snapshots.some((snapshot) => snapshot.data.status === 'COMPLETED');
  }, [pendingLocalQuery.data]);

  const isInitialLoading = listQuery.isLoading && !listQuery.data;

  return (
    <main className="flex flex-1 flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Records personnels</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Meilleures performances calculées depuis tes séances terminées.
        </p>
      </header>

      {hasPendingCompletedSync ? (
        <p
          className="rounded-[var(--radius)] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          role="status"
        >
          Certains nouveaux résultats sont en attente de synchronisation.
        </p>
      ) : null}

      {isInitialLoading ? <PersonalRecordsSkeleton /> : null}

      {listQuery.isError && !listQuery.data ? (
        <div
          className="rounded-[var(--radius)] border border-red-200 bg-red-50 p-4"
          role="alert"
        >
          <p className="text-sm text-[var(--danger)]">
            {getApiErrorMessage(
              listQuery.error,
              'Impossible de charger les records.',
            )}
          </p>
          <button
            type="button"
            className="mt-3 text-sm font-semibold text-[var(--primary)] underline-offset-2 hover:underline"
            onClick={() => void listQuery.refetch()}
          >
            Réessayer
          </button>
        </div>
      ) : null}

      {!isInitialLoading && !listQuery.isError && records.length === 0 ? (
        <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-5">
          <h2 className="text-lg font-semibold">Aucun record pour le moment.</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Les records apparaîtront après tes premières séries terminées dans
            une séance complétée.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <ButtonLink to="/programs">Voir mes programmes</ButtonLink>
            <ButtonLink to="/workouts" variant="secondary">
              Voir mon historique
            </ButtonLink>
          </div>
        </section>
      ) : null}

      {groups.length > 0 ? (
        <div className="flex flex-col gap-8">
          {groups.map((group) => (
            <section
              key={group.exerciseId}
              aria-labelledby={`records-exercise-${group.exerciseId}`}
            >
              <h2
                id={`records-exercise-${group.exerciseId}`}
                className="mb-3 text-lg font-semibold tracking-tight"
              >
                {group.name}
              </h2>
              <ul className="flex flex-col gap-3">
                {group.records.map((record) => (
                  <li
                    key={`${record.recordType}-${record.equipment.id ?? 'none'}-${record.source.workoutSetId}`}
                  >
                    <PersonalRecordCard record={record} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}

      {listQuery.hasNextPage ? (
        <div className="flex flex-col items-stretch gap-2">
          {listQuery.isFetchingNextPage ? (
            <p className="text-sm text-[var(--muted)]" aria-busy="true">
              Chargement…
            </p>
          ) : null}
          {listQuery.isFetchNextPageError ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {getApiErrorMessage(
                listQuery.error,
                'Impossible de charger la suite.',
              )}
            </p>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            disabled={listQuery.isFetchingNextPage}
            onClick={() => void listQuery.fetchNextPage()}
          >
            Charger plus
          </Button>
        </div>
      ) : null}
    </main>
  );
}
