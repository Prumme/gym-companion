import type { WorkoutHistoryListItem } from '@gym-companion/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Button, ButtonLink } from '@/components/ui/button';
import { getMe } from '@/features/profile/api/profile-api';
import { getApiErrorMessage } from '@/lib/api/client';

import {
  pendingTerminalLocalQueryOptions,
  workoutHistoryInfiniteQueryOptions,
} from '../api/workout-query-options';
import { WorkoutHistoryCard } from '../components/WorkoutHistoryCard';
import { WorkoutHistoryFiltersBar } from '../components/WorkoutHistoryFilters';
import {
  buildWorkoutHistorySearchParamsFromFilters,
  countActiveWorkoutHistoryFilters,
  parseWorkoutHistorySearchParams,
  toWorkoutHistoryApiFilters,
  type WorkoutHistoryUrlFilters,
} from '../lib/workout-history-filters';
import { computeWorkoutProgress } from '../lib/workout-progress';
import type { StoredWorkoutSnapshot } from '../offline/types';

function dedupeHistoryItems(
  items: WorkoutHistoryListItem[],
): WorkoutHistoryListItem[] {
  const seen = new Set<string>();
  const result: WorkoutHistoryListItem[] = [];
  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    result.push(item);
  }
  return result;
}

function snapshotToHistoryItem(
  snapshot: StoredWorkoutSnapshot,
): WorkoutHistoryListItem {
  const session = snapshot.data;
  const progress = computeWorkoutProgress(session);
  const status =
    session.status === 'CANCELLED' ? 'CANCELLED' : 'COMPLETED';

  return {
    id: session.id,
    name: session.name,
    status,
    localDate: session.localDate,
    timezone: session.timezone,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    cancelledAt: session.cancelledAt,
    source: session.source,
    summary: {
      exerciseCount: progress.totalExercises,
      totalSetCount: progress.totalSets,
      processedSetCount: progress.recordedSets,
      completedSetCount: progress.completedSets,
      partialSetCount: progress.partialSets,
      failedSetCount: progress.failedSets,
      skippedSetCount: progress.skippedSets,
      pendingSetCount: progress.pendingSets,
    },
  };
}

function WorkoutHistoryListSkeleton() {
  return (
    <ul className="flex flex-col gap-3" aria-busy="true" aria-label="Chargement">
      {Array.from({ length: 4 }).map((_, index) => (
        <li
          key={index}
          className="h-28 animate-pulse rounded-[var(--radius)] border border-[var(--border)] bg-slate-100"
        />
      ))}
    </ul>
  );
}

export function WorkoutsHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = parseWorkoutHistorySearchParams(searchParams);
  const [draft, setDraft] = useState<WorkoutHistoryUrlFilters>(filters);
  const apiFilters = toWorkoutHistoryApiFilters(filters);
  const historySearch = searchParams.toString()
    ? `?${searchParams.toString()}`
    : '';
  const activeFilterCount = countActiveWorkoutHistoryFilters(filters);
  const hasAnyFilter = activeFilterCount > 0;

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    staleTime: 60_000,
  });
  const userId = meQuery.data?.data.id ?? null;

  const listQuery = useInfiniteQuery(
    workoutHistoryInfiniteQueryOptions(apiFilters),
  );
  const pendingLocalQuery = useQuery(pendingTerminalLocalQueryOptions(userId));

  const serverItems = useMemo(
    () =>
      dedupeHistoryItems(
        listQuery.data?.pages.flatMap((page) => page.data) ?? [],
      ),
    [listQuery.data],
  );

  const serverIds = useMemo(
    () => new Set(serverItems.map((item) => item.id)),
    [serverItems],
  );

  const pendingLocalItems = useMemo(() => {
    const snapshots = pendingLocalQuery.data ?? [];
    return snapshots
      .filter((snapshot) => !serverIds.has(snapshot.workoutSessionId))
      .filter((snapshot) => {
        if (filters.status !== 'ALL' && snapshot.data.status !== filters.status) {
          return false;
        }
        if (filters.from && snapshot.data.localDate < filters.from) {
          return false;
        }
        if (filters.to && snapshot.data.localDate > filters.to) {
          return false;
        }
        return true;
      })
      .map(snapshotToHistoryItem);
  }, [pendingLocalQuery.data, serverIds, filters]);

  const totalLoaded = serverItems.length + pendingLocalItems.length;
  const isInitialLoading = listQuery.isLoading && !listQuery.data;

  function applyFiltersToUrl(next: WorkoutHistoryUrlFilters) {
    const params = buildWorkoutHistorySearchParamsFromFilters(next);
    setSearchParams(params, { replace: true });
  }

  function resetFilters() {
    setDraft({ status: 'ALL' });
    setSearchParams(new URLSearchParams(), { replace: true });
  }

  return (
    <main className="flex flex-1 flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Historique</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Consulte tes séances terminées et annulées (lecture seule, snapshots).
        </p>
      </header>

      <WorkoutHistoryFiltersBar
        filters={filters}
        draft={draft}
        onDraftChange={setDraft}
        onApplyDesktop={applyFiltersToUrl}
        onApplyMobile={() => applyFiltersToUrl(draft)}
        onReset={resetFilters}
        activeFilterCount={activeFilterCount}
      />

      <div className="flex items-center justify-between gap-3 text-sm text-[var(--muted)]">
        <p aria-live="polite">
          {isInitialLoading
            ? 'Chargement…'
            : `${totalLoaded} séance${totalLoaded > 1 ? 's' : ''} chargée${totalLoaded > 1 ? 's' : ''}`}
        </p>
        {hasAnyFilter ? (
          <button
            type="button"
            className="text-sm font-medium text-[var(--primary)] underline-offset-2 hover:underline"
            onClick={resetFilters}
          >
            Réinitialiser les filtres
          </button>
        ) : null}
      </div>

      {listQuery.isError && !listQuery.data ? (
        <div
          className="rounded-[var(--radius)] border border-red-200 bg-red-50 p-4"
          role="alert"
        >
          <p className="text-sm text-[var(--danger)]">
            {getApiErrorMessage(
              listQuery.error,
              'Impossible de charger l’historique.',
            )}
          </p>
          <Button
            type="button"
            variant="secondary"
            className="mt-3"
            onClick={() => void listQuery.refetch()}
          >
            Réessayer
          </Button>
        </div>
      ) : null}

      {isInitialLoading ? <WorkoutHistoryListSkeleton /> : null}

      {!isInitialLoading && totalLoaded === 0 && !listQuery.isError ? (
        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-6 text-center">
          <p className="text-sm text-[var(--muted)]">
            {hasAnyFilter
              ? 'Aucune séance ne correspond à ces filtres.'
              : 'Aucune séance terminée ou annulée.'}
          </p>
          <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
            {hasAnyFilter ? (
              <Button type="button" variant="secondary" onClick={resetFilters}>
                Réinitialiser les filtres
              </Button>
            ) : (
              <>
                <ButtonLink to="/planning" variant="secondary">
                  Consulter mon planning
                </ButtonLink>
                <ButtonLink to="/programs" variant="secondary">
                  Voir mes programmes
                </ButtonLink>
              </>
            )}
          </div>
        </div>
      ) : null}

      {totalLoaded > 0 ? (
        <>
          <ul className="flex flex-col gap-3">
            {pendingLocalItems.map((item) => (
              <WorkoutHistoryCard
                key={`local-${item.id}`}
                item={item}
                historySearch={historySearch}
                pendingSync
              />
            ))}
            {serverItems.map((item) => (
              <WorkoutHistoryCard
                key={item.id}
                item={item}
                historySearch={historySearch}
              />
            ))}
          </ul>

          {listQuery.isFetchNextPageError ? (
            <div
              className="rounded-[var(--radius)] border border-red-200 bg-red-50 p-3"
              role="alert"
            >
              <p className="text-sm text-[var(--danger)]">
                {getApiErrorMessage(
                  listQuery.error,
                  'Impossible de charger la suite.',
                )}
              </p>
              <Button
                type="button"
                variant="secondary"
                className="mt-2"
                onClick={() => void listQuery.fetchNextPage()}
              >
                Réessayer
              </Button>
            </div>
          ) : null}

          {listQuery.hasNextPage ? (
            <Button
              type="button"
              variant="secondary"
              disabled={listQuery.isFetchingNextPage}
              onClick={() => void listQuery.fetchNextPage()}
              aria-busy={listQuery.isFetchingNextPage}
            >
              {listQuery.isFetchingNextPage ? 'Chargement…' : 'Charger plus'}
            </Button>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
