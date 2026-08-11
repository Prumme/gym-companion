import type {
  ExerciseProgressMetric,
  ExerciseProgressPoint,
  ExerciseProgressSummary,
} from '@gym-companion/shared';
import { Link } from 'react-router-dom';

import { ButtonLink } from '@/components/ui/button';

import {
  formatProgressChange,
  formatProgressChartDate,
  formatProgressMetricValue,
  type ProgressPeriodPreset,
} from '../lib/progress-filters';
import { getExerciseProgressMetricLabel } from '../lib/progress-labels';
import { PeriodChips } from './PeriodChips';

type ProgressSummaryCardsProps = {
  summary: ExerciseProgressSummary | null;
  metric: ExerciseProgressMetric;
};

export function ProgressSummaryCards({
  summary,
  metric,
}: ProgressSummaryCardsProps) {
  if (!summary || summary.pointCount === 0) {
    return null;
  }

  if (summary.pointCount === 1) {
    return (
      <section
        className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-4 py-3"
        aria-label="Meilleure performance"
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          Valeur enregistrée
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
          {formatProgressMetricValue(metric, summary.latestValue!)}
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Une deuxième séance permettra de comparer ton évolution.
        </p>
      </section>
    );
  }

  const changeLabel = formatProgressChange(
    summary.absoluteChange,
    summary.percentageChange,
    metric,
  );

  return (
    <section aria-labelledby="exercise-best-heading">
      <h2 id="exercise-best-heading" className="sr-only">
        Synthèse
      </h2>
      <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          Meilleure perf
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
          {formatProgressMetricValue(metric, summary.bestValue!)}
        </p>
        {summary.bestDate ? (
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            {formatProgressChartDate(summary.bestDate, 'full')}
          </p>
        ) : null}
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <li className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
            Dernière
          </p>
          <p className="mt-1 text-base font-semibold tabular-nums">
            {formatProgressMetricValue(metric, summary.latestValue!)}
          </p>
        </li>
        <li className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
            Variation
          </p>
          <p className="mt-1 text-base font-semibold tabular-nums">
            {changeLabel ?? '—'}
          </p>
        </li>
        <li className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 col-span-2 sm:col-span-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
            Séances
          </p>
          <p className="mt-1 text-base font-semibold tabular-nums">
            {summary.pointCount}
          </p>
        </li>
      </ul>
    </section>
  );
}

type ProgressPointsListProps = {
  points: ExerciseProgressPoint[];
  metric: ExerciseProgressMetric;
};

export function ProgressPointsList({
  points,
  metric,
}: ProgressPointsListProps) {
  if (points.length === 0) {
    return null;
  }

  const chronological = [...points].reverse();

  return (
    <section aria-labelledby="progress-points-heading">
      <h2
        id="progress-points-heading"
        className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]"
      >
        Dernières séances
      </h2>
      <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
        {chronological.map((point) => {
          const secondary: string[] = [];
          if (metric === 'MAX_WEIGHT' && point.context.maxReps != null) {
            secondary.push(
              `${point.context.maxReps} rep${point.context.maxReps > 1 ? 's' : ''}`,
            );
          }
          if (metric === 'MAX_REPS' && point.context.maxWeightKg != null) {
            secondary.push(
              formatProgressMetricValue('MAX_WEIGHT', point.context.maxWeightKg),
            );
          }
          if (point.context.equipmentName) {
            secondary.push(point.context.equipmentName);
          }

          return (
            <li key={`${point.workoutSessionId}-${point.startedAt}`}>
              <Link
                to={`/workouts/${point.workoutSessionId}`}
                className="flex min-h-14 items-center justify-between gap-3 py-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {formatProgressChartDate(point.localDate, 'full')}
                  </p>
                  <p className="text-sm tabular-nums text-[var(--muted)]">
                    <span className="font-semibold text-[var(--foreground)]">
                      {formatProgressMetricValue(metric, point.value)}
                    </span>
                    {secondary.length > 0 ? ` · ${secondary.join(' · ')}` : ''}
                  </p>
                </div>
                <span className="shrink-0 text-[var(--muted)]" aria-hidden="true">
                  ›
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function ProgressEmptyState() {
  return (
    <div
      className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-4 py-8 text-center"
      role="status"
    >
      <h2 className="text-lg font-semibold">Pas encore de données</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--muted)]">
        Les performances apparaîtront ici après une séance terminée contenant
        cet exercice.
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
    </div>
  );
}

type ProgressControlsProps = {
  availableMetrics: ExerciseProgressMetric[];
  selectedMetric: ExerciseProgressMetric | null;
  period: string;
  from?: string;
  to?: string;
  onMetricChange: (metric: ExerciseProgressMetric) => void;
  onPeriodChange: (period: string) => void;
  onCustomFromChange: (value: string) => void;
  onCustomToChange: (value: string) => void;
};

export function ProgressControls({
  availableMetrics,
  selectedMetric,
  period,
  from,
  to,
  onMetricChange,
  onPeriodChange,
  onCustomFromChange,
  onCustomToChange,
}: ProgressControlsProps) {
  return (
    <div className="flex flex-col gap-3">
      <PeriodChips
        value={period as ProgressPeriodPreset}
        onChange={(next) => onPeriodChange(next)}
      />

      <label className="flex min-w-0 flex-col gap-1 text-sm" htmlFor="exercise-metric">
        <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          Métrique
        </span>
        <select
          id="exercise-metric"
          aria-label="Métrique"
          className="min-h-11 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--primary)]"
          value={selectedMetric ?? ''}
          onChange={(event) =>
            onMetricChange(event.target.value as ExerciseProgressMetric)
          }
          disabled={availableMetrics.length === 0}
        >
          {availableMetrics.length === 0 ? (
            <option value="">Aucune métrique</option>
          ) : null}
          {availableMetrics.map((metric) => (
            <option key={metric} value={metric}>
              {getExerciseProgressMetricLabel(metric)}
            </option>
          ))}
        </select>
      </label>

      {period === 'custom' ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="flex min-w-0 flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Du</span>
            <input
              type="date"
              className="min-h-11 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] px-3"
              value={from ?? ''}
              onChange={(event) => onCustomFromChange(event.target.value)}
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Au</span>
            <input
              type="date"
              className="min-h-11 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] px-3"
              value={to ?? ''}
              onChange={(event) => onCustomToChange(event.target.value)}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
