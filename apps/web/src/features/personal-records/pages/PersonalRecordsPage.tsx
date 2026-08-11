import type { PersonalRecord } from '@gym-companion/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { Button, ButtonLink } from '@/components/ui/button';
import { getMe } from '@/features/profile/api/profile-api';
import { pendingTerminalLocalQueryOptions } from '@/features/workouts/api/workout-query-options';
import { getApiErrorMessage } from '@/lib/api/client';

import { personalRecordsInfiniteQueryOptions } from '../api/personal-record-query-options';
import { PersonalRecordRow } from '../components/PersonalRecordRow';
import {
  formatPersonalRecordDate,
  formatPersonalRecordValue,
  getPersonalRecordTypeLabel,
} from '../lib/personal-record-labels';

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
    <ul className="flex flex-col gap-2" aria-busy="true" aria-label="Chargement">
      {Array.from({ length: 4 }).map((_, index) => (
        <li
          key={index}
          className="h-14 animate-pulse rounded-[var(--radius-control)] bg-[var(--surface)]"
        />
      ))}
    </ul>
  );
}

function LatestRecordHero({ record }: { record: PersonalRecord }) {
  return (
    <section
      className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-4 py-3"
      aria-labelledby="latest-record-heading"
    >
      <h2
        id="latest-record-heading"
        className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]"
      >
        Dernier record battu
      </h2>
      <p className="mt-1 font-semibold tracking-tight">{record.exercise.name}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">
        {formatPersonalRecordValue(record)}
        <span className="ml-2 text-sm font-normal text-[var(--muted)]">
          {getPersonalRecordTypeLabel(record.recordType)}
        </span>
      </p>
      <p className="mt-0.5 text-xs text-[var(--muted)]">
        {formatPersonalRecordDate(record.achievedOn)}
      </p>
    </section>
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
  const latestRecord = useMemo(() => {
    if (records.length === 0) return null;
    return [...records].sort((a, b) => {
      const byDate = b.achievedOn.localeCompare(a.achievedOn);
      if (byDate !== 0) return byDate;
      return (b.achievedAt ?? '').localeCompare(a.achievedAt ?? '');
    })[0]!;
  }, [records]);

  const hasPendingCompletedSync = useMemo(() => {
    const snapshots = pendingLocalQuery.data ?? [];
    return snapshots.some((snapshot) => snapshot.data.status === 'COMPLETED');
  }, [pendingLocalQuery.data]);

  const isInitialLoading = listQuery.isLoading && !listQuery.data;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5">
      <header>
        <Link
          to="/progress"
          className="mb-2 inline-flex min-h-11 items-center text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          ← Progression
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Records personnels</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Tes meilleures performances validées.
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
        <section
          className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-4 py-8 text-center"
          role="status"
        >
          <h2 className="text-lg font-semibold">Aucun record pour le moment.</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--muted)]">
            Tes records apparaîtront après tes premières séries validées dans des
            séances terminées.
          </p>
          <div className="mt-5 flex flex-col items-center gap-2">
            <ButtonLink to="/programs" className="w-full max-w-xs">
              Voir mes programmes
            </ButtonLink>
            <Link
              to="/workouts"
              className="inline-flex min-h-11 items-center text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              Voir mon historique
            </Link>
          </div>
        </section>
      ) : null}

      {latestRecord ? <LatestRecordHero record={latestRecord} /> : null}

      {groups.length > 0 ? (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <section
              key={group.exerciseId}
              aria-labelledby={`records-exercise-${group.exerciseId}`}
            >
              <h2
                id={`records-exercise-${group.exerciseId}`}
                className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]"
              >
                {group.name}
              </h2>
              <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                {group.records.map((record) => (
                  <PersonalRecordRow
                    key={`${record.recordType}-${record.equipment.id ?? 'none'}-${record.source.workoutSetId}`}
                    record={record}
                    showExerciseName={false}
                  />
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
