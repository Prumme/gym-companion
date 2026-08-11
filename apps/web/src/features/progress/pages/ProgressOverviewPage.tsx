import type {
  ProgressOverviewMetric,
  ProgressOverviewPoint,
} from '@gym-companion/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { LoadingState } from '@/components/common/LoadingState';
import { getMe } from '@/features/profile/api/profile-api';
import { pendingTerminalLocalQueryOptions } from '@/features/workouts/api/workout-query-options';
import { getApiErrorMessage } from '@/lib/api/client';

import { progressOverviewQueryOptions } from '../api/progress-query-options';
import { ProgressOverviewChart } from '../components/ProgressOverviewChart';
import {
  OverviewControls,
  OverviewEmptyState,
  OverviewRecentRecords,
  OverviewTopExercises,
  OverviewTotalsCards,
} from '../components/ProgressOverviewSections';
import {
  buildOverviewSearchParams,
  formatOverviewMetricValue,
  parseOverviewSearchParams,
  resolvePresetRange,
  type OverviewUrlFilters,
} from '../lib/overview-filters';
import { getProgressOverviewMetricLabel } from '../lib/overview-labels';
import type { ProgressPeriodPreset } from '../lib/progress-filters';

function latestTimelineValue(
  points: ProgressOverviewPoint[],
  metric: ProgressOverviewMetric,
): number | null {
  if (points.length === 0) return null;
  const last = points[points.length - 1]!;
  switch (metric) {
    case 'WORKOUT_COUNT':
      return last.workoutCount;
    case 'PERFORMED_SETS':
      return last.performedSetCount;
    case 'TOTAL_REPS':
      return last.totalReps;
    case 'WORKING_EXTERNAL_VOLUME':
      return last.workingExternalVolumeKg;
    case 'TOTAL_DURATION':
      return last.totalDurationSeconds;
    case 'TOTAL_DISTANCE':
      return last.totalDistanceMeters;
    default: {
      const _exhaustive: never = metric;
      return _exhaustive;
    }
  }
}

export function ProgressOverviewPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlFilters = useMemo(
    () => parseOverviewSearchParams(searchParams),
    [searchParams],
  );

  const apiFilters = useMemo(
    () => ({
      metric: urlFilters.metric,
      from: urlFilters.from,
      to: urlFilters.to,
    }),
    [urlFilters],
  );

  const overviewQuery = useQuery(progressOverviewQueryOptions(apiFilters));

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    staleTime: 60_000,
  });
  const userId = meQuery.data?.data.id ?? null;
  const pendingLocalQuery = useQuery(pendingTerminalLocalQueryOptions(userId));

  const updateFilters = (next: OverviewUrlFilters) => {
    setSearchParams(buildOverviewSearchParams(next), { replace: true });
  };

  if (overviewQuery.isLoading) {
    return <LoadingState label="Chargement de la progression…" />;
  }

  if (overviewQuery.isError || !overviewQuery.data) {
    return (
      <main className="flex flex-1 flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Progression</h1>
        <div
          className="rounded-[var(--radius)] border border-red-200 bg-red-50 p-4"
          role="alert"
        >
          <p className="text-sm text-[var(--danger)]">
            {getApiErrorMessage(
              overviewQuery.error,
              'Impossible de charger le dashboard de progression.',
            )}
          </p>
          <button
            type="button"
            className="mt-3 text-sm font-semibold text-[var(--primary)] underline-offset-2 hover:underline"
            onClick={() => void overviewQuery.refetch()}
          >
            Réessayer
          </button>
        </div>
      </main>
    );
  }

  const data = overviewQuery.data;
  const selectedMetric =
    urlFilters.metric && data.availableMetrics.includes(urlFilters.metric)
      ? urlFilters.metric
      : data.selectedMetric;
  const isEmpty = data.totals.workoutCount === 0;
  const latestValue = latestTimelineValue(data.timeline.points, selectedMetric);
  const periodLabel =
    data.range.from && data.range.to
      ? `${data.range.from} → ${data.range.to}`
      : 'Toute la période';

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Progression</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Résumé de ton activité et de tes performances.
          </p>
        </div>
        <Link
          to="/records"
          className="inline-flex min-h-11 shrink-0 items-center text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          Records →
        </Link>
      </header>

      {pendingLocalQuery.data && pendingLocalQuery.data.length > 0 ? (
        <p
          className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--muted)]"
          role="status"
        >
          Des données de séance sont en attente de synchronisation.
        </p>
      ) : null}

      <OverviewControls
        availableMetrics={data.availableMetrics}
        selectedMetric={selectedMetric}
        period={urlFilters.period}
        from={urlFilters.from}
        to={urlFilters.to}
        onMetricChange={(metric: ProgressOverviewMetric) =>
          updateFilters({ ...urlFilters, metric })
        }
        onPeriodChange={(period: ProgressPeriodPreset) => {
          if (period === 'all') {
            updateFilters({
              metric: urlFilters.metric,
              from: undefined,
              to: undefined,
              period: 'all',
            });
            return;
          }
          if (period === 'custom') {
            updateFilters({ ...urlFilters, period: 'custom' });
            return;
          }
          const range = resolvePresetRange(period);
          updateFilters({
            metric: urlFilters.metric,
            from: range.from,
            to: range.to,
            period,
          });
        }}
        onCustomFromChange={(value) =>
          updateFilters({
            ...urlFilters,
            period: 'custom',
            from: value || undefined,
          })
        }
        onCustomToChange={(value) =>
          updateFilters({
            ...urlFilters,
            period: 'custom',
            to: value || undefined,
          })
        }
      />

      {isEmpty ? (
        <OverviewEmptyState />
      ) : (
        <>
          <OverviewTotalsCards data={data} />

          <section
            className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4"
            aria-label="Graphique de progression globale"
          >
            <div className="mb-3 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold">
                  {getProgressOverviewMetricLabel(selectedMetric)}
                </h2>
                <p className="mt-0.5 text-xs text-[var(--muted)]">{periodLabel}</p>
              </div>
              {latestValue != null ? (
                <p className="shrink-0 text-right text-lg font-semibold tabular-nums">
                  {formatOverviewMetricValue(selectedMetric, latestValue)}
                </p>
              ) : null}
            </div>
            <ProgressOverviewChart
              points={data.timeline.points}
              metric={selectedMetric}
              bucket={data.timeline.bucket}
            />
          </section>

          <OverviewRecentRecords records={data.recentRecords} />
          <OverviewTopExercises exercises={data.topExercises} />
        </>
      )}
    </main>
  );
}
