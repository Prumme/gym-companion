import type { WorkoutHistoryListItem } from '@gym-companion/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { getMe } from '@/features/profile/api/profile-api';
import { getApiErrorMessage } from '@/lib/api/client';

import {
  pendingTerminalLocalQueryOptions,
  workoutHistoryInfiniteQueryOptions,
} from '../api/workout-query-options';
import { WorkoutHistoryRow } from '../components/WorkoutHistoryCard';
import { WorkoutHistoryFiltersBar } from '../components/WorkoutHistoryFilters';
import {
  formatHistoryDayHeading,
  groupWorkoutHistoryItems,
} from '../lib/workout-history-groups';
import {
  buildWorkoutHistorySearchParamsFromFilters,
  parseWorkoutHistorySearchParams,
  toWorkoutHistoryApiFilters,
  type WorkoutHistoryStatusFilterValue,
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

function countPeriodFilters(filters: WorkoutHistoryUrlFilters): number {
  let count = 0;
  if (filters.from) count += 1;
  if (filters.to) count += 1;
  return count;
}

function WorkoutHistoryListSkeleton() {
  return (
    <ul className="flex flex-col gap-2" aria-busy="true" aria-label="Chargement">
      {Array.from({ length: 4 }).map((_, index) => (
        <li
          key={index}
          className="h-14 animate-pulse rounded-[var(--radius-control)] bg-[var(--border)]/60"
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
  const periodFilterCount = countPeriodFilters(filters);
  const hasAnyFilter = filters.status !== 'ALL' || periodFilterCount > 0;

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

  const allItems = useMemo(
    () => [...pendingLocalItems, ...serverItems],
    [pendingLocalItems, serverItems],
  );
  const groups = useMemo(
    () => groupWorkoutHistoryItems(allItems),
    [allItems],
  );

  const totalLoaded = allItems.length;
  const isInitialLoading = listQuery.isLoading && !listQuery.data;

  function applyFiltersToUrl(next: WorkoutHistoryUrlFilters) {
    const params = buildWorkoutHistorySearchParamsFromFilters(next);
    setSearchParams(params, { replace: true });
  }

  function handleStatusChange(status: WorkoutHistoryStatusFilterValue) {
    const next = { ...filters, status };
    setDraft(next);
    applyFiltersToUrl(next);
  }

  function resetPeriod() {
    const next = { ...filters, from: undefined, to: undefined };
    setDraft(next);
    applyFiltersToUrl(next);
  }

  function resetAllFilters() {
    setDraft({ status: 'ALL' });
    setSearchParams(new URLSearchParams(), { replace: true });
  }

  return (
    <main className="flex flex-1 flex-col gap-5">
      <PageHeader
        title="Historique"
        description="Tes séances passées"
        className="mb-0"
      />

      <WorkoutHistoryFiltersBar
        filters={filters}
        draft={draft}
        onDraftChange={setDraft}
        onStatusChange={handleStatusChange}
        onApplyPeriod={applyFiltersToUrl}
        onResetPeriod={resetPeriod}
        periodFilterCount={periodFilterCount}
      />

      <div className="flex items-center justify-between gap-3 text-sm text-[var(--muted)]">
        <p aria-live="polite">
          {isInitialLoading
            ? 'Chargement…'
            : `${totalLoaded} séance${totalLoaded > 1 ? 's' : ''}`}
        </p>
        {hasAnyFilter ? (
          <button
            type="button"
            className="text-sm font-medium text-[var(--foreground)] underline-offset-2 hover:underline"
            onClick={resetAllFilters}
          >
            Réinitialiser
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
        hasAnyFilter ? (
          <EmptyState
            title="Aucune séance trouvée"
            description="Aucune séance ne correspond à ces filtres."
            action={{
              label: 'Réinitialiser les filtres',
              onClick: resetAllFilters,
            }}
          />
        ) : (
          <EmptyState
            title="Aucune séance dans l’historique"
            description="Tes séances terminées apparaîtront ici."
            action={{ label: 'Voir mon planning', to: '/planning' }}
            secondaryAction={{
              label: 'Voir mes programmes',
              to: '/programs',
            }}
          />
        )
      ) : null}

      {totalLoaded > 0 ? (
        <>
          <div className="flex flex-col gap-6">
            {groups.map((group) => (
              <section key={group.key} aria-labelledby={`history-group-${group.key}`}>
                <h2
                  id={`history-group-${group.key}`}
                  className="mb-1 text-xs font-semibold tracking-[0.12em] text-[var(--muted)] uppercase"
                >
                  {group.label}
                </h2>
                <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                  {group.items.map((item, index) => {
                    const prev = group.items[index - 1];
                    const showDay =
                      group.key !== 'Aujourd’hui' &&
                      group.key !== 'Hier' &&
                      prev?.localDate !== item.localDate;
                    return (
                      <WorkoutHistoryRow
                        key={
                          pendingLocalItems.some((p) => p.id === item.id)
                            ? `local-${item.id}`
                            : item.id
                        }
                        item={item}
                        historySearch={historySearch}
                        pendingSync={pendingLocalItems.some(
                          (p) => p.id === item.id,
                        )}
                        showDayHeading={showDay}
                        dayHeading={
                          showDay
                            ? formatHistoryDayHeading(item.localDate)
                            : undefined
                        }
                      />
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>

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
