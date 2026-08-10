import type { WorkoutHistoryListItem } from '@gym-companion/shared';
import { Link } from 'react-router-dom';

import { formatWorkoutReps, formatWorkoutVolume } from '../lib/workout-metrics-format';
import { getWorkoutStatusLabel } from '../lib/workout-labels';
import type { WorkoutHistoryNavigationState } from '../lib/workout-history-filters';

function formatStartTime(startedAt: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone,
      timeStyle: 'short',
    }).format(new Date(startedAt));
  } catch {
    return startedAt;
  }
}

type WorkoutHistoryCardProps = {
  item: WorkoutHistoryListItem;
  historySearch: string;
  pendingSync?: boolean;
};

export function WorkoutHistoryCard({
  item,
  historySearch,
  pendingSync = false,
}: WorkoutHistoryCardProps) {
  const state: WorkoutHistoryNavigationState = {
    fromHistory: true,
    historySearch,
  };
  const { summary } = item;

  return (
    <li>
      <Link
        to={`/workouts/${item.id}`}
        state={state}
        className="block rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
        aria-label={`Ouvrir la séance ${item.name} du ${item.localDate}`}
      >
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold text-[var(--foreground)]">
              {item.name}
            </h2>
            <p
              className={
                item.status === 'CANCELLED'
                  ? 'text-sm font-medium text-[var(--danger)]'
                  : 'text-sm font-medium text-[var(--muted)]'
              }
            >
              {getWorkoutStatusLabel(item.status)}
            </p>
          </div>

          {pendingSync ? (
            <p className="text-xs font-medium text-amber-700" role="status">
              En attente de synchronisation
            </p>
          ) : null}

          <dl className="grid gap-1 text-sm text-[var(--muted)]">
            <div>
              <dt className="sr-only">Date</dt>
              <dd>
                {item.localDate}
                {' · '}
                {formatStartTime(item.startedAt, item.timezone)}
              </dd>
            </div>
            {item.source.programName ? (
              <div>
                <dt className="inline">Programme : </dt>
                <dd className="inline">{item.source.programName}</dd>
              </div>
            ) : null}
            {item.source.workoutTemplateName ? (
              <div>
                <dt className="inline">Modèle : </dt>
                <dd className="inline">{item.source.workoutTemplateName}</dd>
              </div>
            ) : null}
            <div>
              <dt className="sr-only">Progression</dt>
              <dd>
                {summary.exerciseCount} exercice
                {summary.exerciseCount === 1 ? '' : 's'}
                {' · '}
                {summary.processedSetCount} série
                {summary.processedSetCount === 1 ? '' : 's'} enregistrée
                {summary.processedSetCount === 1 ? '' : 's'} sur{' '}
                {summary.totalSetCount}
              </dd>
            </div>
            {item.status === 'COMPLETED' &&
            ((summary.totalReps != null && summary.totalReps > 0) ||
              (summary.workingExternalVolumeKg != null &&
                summary.workingExternalVolumeKg > 0)) ? (
              <div>
                <dt className="sr-only">Performances</dt>
                <dd>
                  {summary.totalReps != null && summary.totalReps > 0
                    ? formatWorkoutReps(summary.totalReps)
                    : null}
                  {summary.totalReps != null &&
                  summary.totalReps > 0 &&
                  summary.workingExternalVolumeKg != null &&
                  summary.workingExternalVolumeKg > 0
                    ? ' · '
                    : null}
                  {summary.workingExternalVolumeKg != null &&
                  summary.workingExternalVolumeKg > 0
                    ? formatWorkoutVolume(summary.workingExternalVolumeKg)
                    : null}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      </Link>
    </li>
  );
}
