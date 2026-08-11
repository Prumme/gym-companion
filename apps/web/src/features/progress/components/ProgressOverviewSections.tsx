import type {
  ProgressOverviewFrequency,
  ProgressOverviewMetric,
  ProgressOverviewResponse,
  ProgressTopExercise,
} from '@gym-companion/shared';
import { Link } from 'react-router-dom';

import { ButtonLink } from '@/components/ui/button';
import { PersonalRecordRow } from '@/features/personal-records/components/PersonalRecordRow';
import {
  formatPersonalRecordDistance,
  formatPersonalRecordDuration,
} from '@/features/personal-records/lib/personal-record-labels';
import {
  formatWorkoutReps,
  formatWorkoutVolume,
} from '@/features/workouts/lib/workout-metrics-format';

import {
  formatAverageWorkoutsPerWeek,
  formatOverviewComparisonPercent,
} from '../lib/overview-filters';
import { getProgressOverviewMetricLabel } from '../lib/overview-labels';
import type { ProgressPeriodPreset } from '../lib/progress-filters';
import { PeriodChips } from './PeriodChips';

type TotalsCardsProps = {
  data: ProgressOverviewResponse;
};

export function OverviewTotalsCards({ data }: TotalsCardsProps) {
  const { totals, comparison, frequency } = data;
  const cards: Array<{
    key: string;
    label: string;
    value: string;
    change?: number | null;
  }> = [
    {
      key: 'workouts',
      label: 'Séances',
      value: `${totals.workoutCount}`,
      change: comparison?.workoutCountChangePercent,
    },
    {
      key: 'sets',
      label: 'Séries',
      value: `${totals.performedSetCount}`,
      change: comparison?.performedSetCountChangePercent,
    },
  ];

  if (totals.workingExternalVolumeKg > 0) {
    cards.push({
      key: 'volume',
      label: 'Volume',
      value: formatWorkoutVolume(totals.workingExternalVolumeKg),
      change: comparison?.workingExternalVolumeChangePercent,
    });
  }
  if (totals.uniqueExerciseCount > 0) {
    cards.push({
      key: 'exercises',
      label: 'Exercices',
      value: `${totals.uniqueExerciseCount}`,
    });
  }
  if (totals.totalReps > 0) {
    cards.push({
      key: 'reps',
      label: 'Répétitions',
      value: formatWorkoutReps(totals.totalReps),
    });
  }
  if (totals.totalDurationSeconds > 0) {
    cards.push({
      key: 'duration',
      label: 'Durée',
      value: formatPersonalRecordDuration(totals.totalDurationSeconds),
    });
  }
  if (totals.totalDistanceMeters > 0) {
    cards.push({
      key: 'distance',
      label: 'Distance',
      value: formatPersonalRecordDistance(totals.totalDistanceMeters),
    });
  }
  if (data.recentRecords.length > 0) {
    cards.push({
      key: 'records',
      label: 'Records récents',
      value: `${data.recentRecords.length}`,
    });
  }

  return (
    <section aria-labelledby="overview-totals-heading">
      <h2 id="overview-totals-heading" className="sr-only">
        Indicateurs clés
      </h2>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {cards.map((card) => (
          <li
            key={card.key}
            className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2.5"
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
              {card.label}
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight">
              {card.value}
            </p>
            {card.change !== undefined && data.comparison ? (
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                {formatOverviewComparisonPercent(card.change ?? null)} vs préc.
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      <FrequencyLine frequency={frequency} workoutCount={totals.workoutCount} />
    </section>
  );
}

function FrequencyLine({
  frequency,
  workoutCount,
}: {
  frequency: ProgressOverviewFrequency;
  workoutCount: number;
}) {
  const average = formatAverageWorkoutsPerWeek(frequency.averageWorkoutsPerWeek);
  return (
    <p className="mt-2 text-sm text-[var(--muted)]">
      {workoutCount} séance{workoutCount > 1 ? 's' : ''} sur{' '}
      {frequency.activeDayCount} jour
      {frequency.activeDayCount > 1 ? 's' : ''} actif
      {frequency.activeDayCount > 1 ? 's' : ''}
      {average ? ` · ${average}` : null}
    </p>
  );
}

export function OverviewEmptyState() {
  return (
    <div
      className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-4 py-8 text-center"
      role="status"
    >
      <h2 className="text-lg font-semibold tracking-tight">
        Pas encore assez de données
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--muted)]">
        Termine quelques séances pour voir apparaître tes tendances et ta
        progression.
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

type OverviewControlsProps = {
  availableMetrics: ProgressOverviewMetric[];
  selectedMetric: ProgressOverviewMetric;
  period: ProgressPeriodPreset;
  from?: string;
  to?: string;
  onMetricChange: (metric: ProgressOverviewMetric) => void;
  onPeriodChange: (period: ProgressPeriodPreset) => void;
  onCustomFromChange: (value: string) => void;
  onCustomToChange: (value: string) => void;
};

export function OverviewControls({
  availableMetrics,
  selectedMetric,
  period,
  from,
  to,
  onMetricChange,
  onPeriodChange,
  onCustomFromChange,
  onCustomToChange,
}: OverviewControlsProps) {
  return (
    <div className="flex flex-col gap-3">
      <PeriodChips value={period} onChange={onPeriodChange} />

      <label className="flex min-w-0 flex-col gap-1 text-sm" htmlFor="overview-metric">
        <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          Métrique
        </span>
        <select
          id="overview-metric"
          aria-label="Métrique du graphique"
          className="min-h-11 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--primary)]"
          value={selectedMetric}
          onChange={(event) =>
            onMetricChange(event.target.value as ProgressOverviewMetric)
          }
        >
          {availableMetrics.map((metric) => (
            <option key={metric} value={metric}>
              {getProgressOverviewMetricLabel(metric)}
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

export function OverviewRecentRecords({
  records,
}: {
  records: ProgressOverviewResponse['recentRecords'];
}) {
  if (records.length === 0) {
    return null;
  }
  return (
    <section aria-labelledby="overview-records-heading">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h2
          id="overview-records-heading"
          className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]"
        >
          Records récents
        </h2>
        <Link
          to="/records"
          className="text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          Tous →
        </Link>
      </div>
      <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
        {records.slice(0, 4).map((record) => (
          <PersonalRecordRow
            key={`${record.recordType}-${record.source.workoutSetId}`}
            record={record}
          />
        ))}
      </ul>
    </section>
  );
}

export function OverviewTopExercises({
  exercises,
}: {
  exercises: ProgressTopExercise[];
}) {
  if (exercises.length === 0) {
    return null;
  }
  return (
    <section aria-labelledby="overview-top-heading">
      <h2
        id="overview-top-heading"
        className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]"
      >
        Exercices les plus travaillés
      </h2>
      <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
        {exercises.map((exercise) => (
          <li key={exercise.exerciseId}>
            <Link
              to={`/progress/exercises/${exercise.exerciseId}`}
              className="flex min-h-14 items-center justify-between gap-3 py-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">{exercise.exerciseName}</p>
                <p className="text-sm text-[var(--muted)]">
                  {exercise.workoutCount} séance
                  {exercise.workoutCount > 1 ? 's' : ''} ·{' '}
                  {exercise.performedSetCount} série
                  {exercise.performedSetCount > 1 ? 's' : ''}
                </p>
              </div>
              <span className="shrink-0 text-sm font-medium text-[var(--muted)]">
                Voir →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
