import type {
  ExerciseProgressMetric,
  ExerciseProgressPoint,
  ExerciseProgressSummary,
} from '@gym-companion/shared';
import { Link } from 'react-router-dom';

import {
  formatProgressChange,
  formatProgressChartDate,
  formatProgressMetricValue,
} from '../lib/progress-filters';
import { getExerciseProgressMetricLabel } from '../lib/progress-labels';

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
      <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
        <p className="text-sm text-[var(--muted)]">Valeur enregistrée</p>
        <p className="mt-1 text-xl font-semibold">
          {formatProgressMetricValue(metric, summary.latestValue!)}
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Une deuxième séance permettra de comparer ton évolution.
        </p>
      </div>
    );
  }

  const changeLabel = formatProgressChange(
    summary.absoluteChange,
    summary.percentageChange,
    metric,
  );

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <li className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3">
        <p className="text-xs text-[var(--muted)]">Dernière valeur</p>
        <p className="mt-1 text-lg font-semibold">
          {formatProgressMetricValue(metric, summary.latestValue!)}
        </p>
      </li>
      <li className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3">
        <p className="text-xs text-[var(--muted)]">Meilleure valeur</p>
        <p className="mt-1 text-lg font-semibold">
          {formatProgressMetricValue(metric, summary.bestValue!)}
        </p>
        {summary.bestDate ? (
          <p className="mt-1 text-xs text-[var(--muted)]">
            {formatProgressChartDate(summary.bestDate, 'full')}
          </p>
        ) : null}
      </li>
      <li className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3">
        <p className="text-xs text-[var(--muted)]">Variation sur la période</p>
        <p className="mt-1 text-lg font-semibold">
          {changeLabel ?? '—'}
        </p>
        {summary.firstValue === 0 ? (
          <p className="mt-1 text-xs text-[var(--muted)]">
            Pourcentage non calculable (première valeur nulle).
          </p>
        ) : null}
      </li>
      <li className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3">
        <p className="text-xs text-[var(--muted)]">Séances</p>
        <p className="mt-1 text-lg font-semibold">{summary.pointCount}</p>
      </li>
    </ul>
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
        className="mb-3 text-sm font-semibold tracking-wide text-[var(--muted)] uppercase"
      >
        Séances contributives
      </h2>
      <ul className="flex flex-col gap-2">
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
            <li
              key={`${point.workoutSessionId}-${point.startedAt}`}
              className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--border)] py-3 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {formatProgressChartDate(point.localDate, 'full')}
                </p>
                <p className="text-sm text-[var(--muted)]">
                  {formatProgressMetricValue(metric, point.value)}
                  {secondary.length > 0 ? ` · ${secondary.join(' · ')}` : ''}
                </p>
              </div>
              <Link
                to={`/workouts/${point.workoutSessionId}`}
                className="text-sm font-semibold text-[var(--primary)] underline-offset-2 hover:underline"
              >
                Voir la séance
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
    <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-6 text-center">
      <p className="font-medium">
        Pas encore de données de progression pour cet exercice.
      </p>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Les performances apparaîtront ici après une séance terminée contenant
        cet exercice.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <Link
          to="/programs"
          className="text-sm font-semibold text-[var(--primary)] underline-offset-2 hover:underline"
        >
          Voir mes programmes
        </Link>
        <Link
          to="/workouts"
          className="text-sm font-semibold text-[var(--primary)] underline-offset-2 hover:underline"
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
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Métrique</span>
        <select
          className="h-10 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-3"
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

      <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Période</span>
        <select
          className="h-10 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-3"
          value={period}
          onChange={(event) => onPeriodChange(event.target.value)}
        >
          <option value="30d">30 jours</option>
          <option value="3m">3 mois</option>
          <option value="6m">6 mois</option>
          <option value="1y">1 an</option>
          <option value="all">Tout</option>
          <option value="custom">Personnalisé</option>
        </select>
      </label>

      {period === 'custom' ? (
        <>
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Du</span>
            <input
              type="date"
              className="h-10 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-3"
              value={from ?? ''}
              onChange={(event) => onCustomFromChange(event.target.value)}
            />
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Au</span>
            <input
              type="date"
              className="h-10 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-3"
              value={to ?? ''}
              onChange={(event) => onCustomToChange(event.target.value)}
            />
          </label>
        </>
      ) : null}
    </div>
  );
}
