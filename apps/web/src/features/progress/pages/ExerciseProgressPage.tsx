import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { ButtonLink } from '@/components/ui/button';
import { LoadingState } from '@/components/common/LoadingState';
import { getApiErrorMessage, type ApiRequestError } from '@/lib/api/client';
import { PlateauAnalysisSection } from '@/features/coaching/components/PlateauAnalysisSection';
import { ExerciseCoachSummarySection } from '@/features/coaching/components/ExerciseCoachSummarySection';
import { ExercisePersonalRecordsSection } from '@/features/personal-records/components/ExercisePersonalRecordsSection';
import { getMeasurementTypeLabel } from '@/features/exercises/lib/exercise-labels';
import { exerciseDetailQueryOptions } from '@/features/exercises/api/exercise-query-options';

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
import { getExerciseProgressMetricLabel } from '../lib/progress-labels';
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

  const exerciseQuery = useQuery({
    ...exerciseDetailQueryOptions(exerciseId),
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
          to="/progress"
          variant="ghost"
          className="w-fit gap-2 px-0"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Progression
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

  const detail = exerciseQuery.data;
  const metaParts: string[] = [];
  if (detail?.primaryMuscleGroup?.name) {
    metaParts.push(detail.primaryMuscleGroup.name);
  }
  if (detail?.defaultEquipmentType?.name) {
    metaParts.push(detail.defaultEquipmentType.name);
  } else if (detail?.measurementType) {
    metaParts.push(getMeasurementTypeLabel(detail.measurementType));
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5">
      <header>
        <Link
          to="/progress"
          className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Progression
        </Link>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          {data.exercise.name}
        </h1>
        {metaParts.length > 0 ? (
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {metaParts.join(' · ')}
          </p>
        ) : null}
        {data.exercise.archived ? (
          <p className="mt-1 text-sm text-amber-800">Exercice archivé</p>
        ) : null}
      </header>

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

          {data.points.length >= 2 &&
          data.summary &&
          data.summary.pointCount < 2 ? (
            <p className="text-sm text-[var(--muted)]">
              Pas encore assez de données pour calculer une évolution.
            </p>
          ) : null}

          <section
            className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4"
            aria-label="Graphique de progression"
          >
            <h2 className="mb-3 text-sm font-semibold">
              {getExerciseProgressMetricLabel(selectedMetric)}
            </h2>
            <ExerciseProgressChart
              points={data.points}
              metric={selectedMetric}
              longRange={longRange}
            />
          </section>

          <ProgressPointsList points={data.points} metric={selectedMetric} />
        </>
      ) : null}

      {exerciseId ? (
        <ExercisePersonalRecordsSection
          exerciseId={exerciseId}
          hideProgressCta
        />
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
