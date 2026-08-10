import type {
  ProgressOverviewComparison,
  ProgressOverviewFrequency,
  ProgressOverviewMetric,
  ProgressOverviewResponse,
  ProgressTopExercise,
} from '@gym-companion/shared';
import { Link } from 'react-router-dom';

import { PersonalRecordCard } from '@/features/personal-records/components/PersonalRecordCard';
import {
  formatWorkoutReps,
  formatWorkoutVolume,
} from '@/features/workouts/lib/workout-metrics-format';
import {
  formatPersonalRecordDistance,
  formatPersonalRecordDuration,
} from '@/features/personal-records/lib/personal-record-labels';

import {
  formatAverageWorkoutsPerWeek,
  formatOverviewComparisonPercent,
} from '../lib/overview-filters';
import { getProgressOverviewMetricLabel } from '../lib/overview-labels';
import type { ProgressPeriodPreset } from '../lib/progress-filters';

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
      label: 'Séries réalisées',
      value: `${totals.performedSetCount}`,
      change: comparison?.performedSetCountChangePercent,
    },
  ];

  if (totals.workingExternalVolumeKg > 0) {
    cards.push({
      key: 'volume',
      label: 'Volume de travail',
      value: formatWorkoutVolume(totals.workingExternalVolumeKg),
      change: comparison?.workingExternalVolumeChangePercent,
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
      label: 'Durée enregistrée',
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

  return (
    <section aria-labelledby="overview-totals-heading">
      <h2 id="overview-totals-heading" className="sr-only">
        Indicateurs clés
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <li
            key={card.key}
            className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3"
          >
            <p className="text-xs text-[var(--muted)]">{card.label}</p>
            <p className="mt-1 text-lg font-semibold">{card.value}</p>
            {card.change !== undefined && data.comparison ? (
              <p className="mt-1 text-xs text-[var(--muted)]">
                {formatOverviewComparisonPercent(card.change ?? null)} vs période
                précédente
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
    <p className="mt-3 text-sm text-[var(--muted)]">
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
    <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-6 text-center">
      <p className="font-medium">
        Pas encore assez de données pour afficher ta progression globale.
      </p>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Les statistiques apparaîtront après tes premières séances terminées.
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
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Période</span>
        <select
          className="h-10 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-3"
          value={period}
          onChange={(event) =>
            onPeriodChange(event.target.value as ProgressPeriodPreset)
          }
        >
          <option value="30d">30 jours</option>
          <option value="3m">3 mois</option>
          <option value="6m">6 mois</option>
          <option value="1y">1 an</option>
          <option value="all">Tout</option>
          <option value="custom">Personnalisé</option>
        </select>
      </label>

      <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Métrique du graphique</span>
        <select
          className="h-10 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-3"
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
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2
          id="overview-records-heading"
          className="text-sm font-semibold tracking-wide text-[var(--muted)] uppercase"
        >
          Records récents
        </h2>
        <Link
          to="/records"
          className="text-sm font-semibold text-[var(--primary)] underline-offset-2 hover:underline"
        >
          Tous les records
        </Link>
      </div>
      <ul className="flex flex-col gap-3">
        {records.map((record) => (
          <li key={`${record.recordType}-${record.source.workoutSetId}`}>
            <PersonalRecordCard record={record} />
          </li>
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
        className="mb-3 text-sm font-semibold tracking-wide text-[var(--muted)] uppercase"
      >
        Exercices les plus pratiqués
      </h2>
      <ul className="flex flex-col gap-2">
        {exercises.map((exercise) => (
          <li
            key={exercise.exerciseId}
            className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--border)] py-3 last:border-b-0"
          >
            <div className="min-w-0">
              <p className="font-medium">{exercise.exerciseName}</p>
              <p className="text-sm text-[var(--muted)]">
                {exercise.workoutCount} séance
                {exercise.workoutCount > 1 ? 's' : ''} ·{' '}
                {exercise.performedSetCount} série
                {exercise.performedSetCount > 1 ? 's' : ''}
              </p>
            </div>
            <Link
              to={`/progress/exercises/${exercise.exerciseId}`}
              className="text-sm font-semibold text-[var(--primary)] underline-offset-2 hover:underline"
            >
              Voir la progression
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Exposé pour éviter un import inutilisé de ProgressOverviewComparison. */
export type { ProgressOverviewComparison };
