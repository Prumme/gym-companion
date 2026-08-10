import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import { ButtonLink } from '@/components/ui/button';
import { LoadingState } from '@/components/common/LoadingState';
import { getApiErrorMessage, type ApiRequestError } from '@/lib/api/client';
import { PlateauAnalysisSection } from '@/features/coaching/components/PlateauAnalysisSection';
import { ExerciseCoachSummarySection } from '@/features/coaching/components/ExerciseCoachSummarySection';

import {
  exerciseProgressQueryOptions,
  exerciseStrengthQueryOptions,
} from '../api/progress-query-options';
import { EstimatedStrengthSection } from '../components/EstimatedStrengthSection';
import { ExerciseProgressChart } from '../components/ExerciseProgressChart';
import {
  ProgressControls,
  ProgressEmptyState,
  ProgressPointsList,
  ProgressSummaryCards,
} from '../components/ProgressSummary';
import {
  buildProgressSearchParams,
  parseProgressSearchParams,
  resolvePresetRange,
  type ProgressPeriodPreset,
  type ProgressUrlFilters,
} from '../lib/progress-filters';
import type { ExerciseProgressMetric } from '@gym-companion/shared';

export function ExerciseProgressPage() {
  const { exerciseId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlFilters = useMemo(
    () => parseProgressSearchParams(searchParams),
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

  const strengthFilters = useMemo(
    () => ({
      from: urlFilters.from,
      to: urlFilters.to,
    }),
    [urlFilters.from, urlFilters.to],
  );

  const progressQuery = useQuery({
    ...exerciseProgressQueryOptions(exerciseId, apiFilters),
    enabled: Boolean(exerciseId),
  });

  const strengthQuery = useQuery({
    ...exerciseStrengthQueryOptions(exerciseId, strengthFilters),
    enabled: Boolean(exerciseId) && progressQuery.isSuccess,
  });

  const updateFilters = (next: ProgressUrlFilters) => {
    setSearchParams(buildProgressSearchParams(next), { replace: true });
  };

  const handleMetricChange = (metric: ExerciseProgressMetric) => {
    updateFilters({ ...urlFilters, metric });
  };

  const handlePeriodChange = (periodValue: string) => {
    const period = periodValue as ProgressPeriodPreset;
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
      updateFilters({
        ...urlFilters,
        period: 'custom',
        from: urlFilters.from,
        to: urlFilters.to,
      });
      return;
    }
    const range = resolvePresetRange(period);
    updateFilters({
      metric: urlFilters.metric,
      from: range.from,
      to: range.to,
      period,
    });
  };

  if (progressQuery.isLoading) {
    return <LoadingState label="Chargement de la progression…" />;
  }

  if (progressQuery.isError || !progressQuery.data) {
    const status = (progressQuery.error as ApiRequestError | undefined)?.status;
    const message =
      status === 404
        ? 'Cet exercice est introuvable ou inaccessible.'
        : getApiErrorMessage(
            progressQuery.error,
            'Impossible de charger la progression.',
          );

    return (
      <main className="flex flex-1 flex-col gap-4">
        <ButtonLink
          to={exerciseId ? `/exercises/${exerciseId}` : '/exercises'}
          variant="ghost"
          className="w-fit gap-2 px-0"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Retour à l’exercice
        </ButtonLink>
        <div
          className="rounded-[var(--radius)] border border-red-200 bg-red-50 p-4"
          role="alert"
        >
          <p className="text-sm text-[var(--danger)]">{message}</p>
          <button
            type="button"
            className="mt-3 text-sm font-semibold text-[var(--primary)] underline-offset-2 hover:underline"
            onClick={() => void progressQuery.refetch()}
          >
            Réessayer
          </button>
        </div>
      </main>
    );
  }

  const data = progressQuery.data;
  const selectedMetric =
    data.selectedMetric ?? urlFilters.metric ?? data.availableMetrics[0] ?? null;
  const longRange =
    urlFilters.period === '1y' ||
    urlFilters.period === 'all' ||
    urlFilters.period === '6m';
  const showExpandHint =
    data.points.length > 0 &&
    data.points.length < 2 &&
    urlFilters.period !== 'all';

  const maxWeightLatestKg =
    selectedMetric === 'MAX_WEIGHT' && data.summary?.latestValue != null
      ? data.summary.latestValue
      : data.points.length > 0 &&
          data.points[data.points.length - 1]?.context.maxWeightKg != null
        ? data.points[data.points.length - 1]!.context.maxWeightKg
        : null;

  const strengthData = strengthQuery.data;
  const likelySupportsStrength = data.availableMetrics.includes('MAX_WEIGHT');
  const showStrengthSection =
    strengthData?.supported === true ||
    (likelySupportsStrength &&
      (strengthQuery.isLoading || strengthQuery.isError));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-0">
      <div>
        <ButtonLink
          to={`/exercises/${exerciseId}`}
          variant="ghost"
          className="mb-3 w-fit gap-2 px-0"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Retour à l’exercice
        </ButtonLink>
        <h1 className="text-2xl font-bold tracking-tight">
          Progression — {data.exercise.name}
        </h1>
        {data.exercise.archived ? (
          <p className="mt-1 text-sm text-[var(--muted)]">Exercice archivé</p>
        ) : null}
      </div>

      <ProgressControls
        availableMetrics={data.availableMetrics}
        selectedMetric={selectedMetric}
        period={urlFilters.period}
        from={urlFilters.from}
        to={urlFilters.to}
        onMetricChange={handleMetricChange}
        onPeriodChange={handlePeriodChange}
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

      {data.points.length === 0 ? <ProgressEmptyState /> : null}

      {data.points.length > 0 && selectedMetric ? (
        <>
          <ProgressSummaryCards
            summary={data.summary}
            metric={selectedMetric}
          />

          {showExpandHint ? (
            <p className="text-sm text-[var(--muted)]">
              Pas encore assez de données sur cette période.{' '}
              <button
                type="button"
                className="font-semibold text-[var(--primary)] underline-offset-2 hover:underline"
                onClick={() => handlePeriodChange('all')}
              >
                Afficher tout l’historique
              </button>
            </p>
          ) : null}

          {data.points.length >= 2 && data.summary && data.summary.pointCount < 2 ? (
            <p className="text-sm text-[var(--muted)]">
              Pas encore assez de données pour calculer une évolution.
            </p>
          ) : null}

          <section
            className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4"
            aria-label="Graphique de progression"
          >
            <ExerciseProgressChart
              points={data.points}
              metric={selectedMetric}
              longRange={longRange}
            />
          </section>

          <ProgressPointsList points={data.points} metric={selectedMetric} />
        </>
      ) : null}

      {showStrengthSection ? (
        <EstimatedStrengthSection
          supported={strengthData?.supported ?? true}
          formula={strengthData?.formula ?? 'EPLEY_V1'}
          eligibility={
            strengthData?.eligibility ?? { minReps: 1, maxReps: 12 }
          }
          summary={strengthData?.summary ?? null}
          points={strengthData?.points ?? []}
          longRange={longRange}
          maxWeightLatestKg={maxWeightLatestKg}
          isLoading={strengthQuery.isLoading}
          isError={strengthQuery.isError}
          onRetry={() => void strengthQuery.refetch()}
        />
      ) : null}

      {exerciseId ? (
        <ExerciseCoachSummarySection
          exerciseId={exerciseId}
          enabled={progressQuery.isSuccess}
        />
      ) : null}

      {exerciseId ? (
        <PlateauAnalysisSection
          exerciseId={exerciseId}
          enabled={progressQuery.isSuccess}
        />
      ) : null}
    </main>
  );
}
