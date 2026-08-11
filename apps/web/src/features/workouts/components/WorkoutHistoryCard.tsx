import type { WorkoutHistoryListItem } from '@gym-companion/shared';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import { cn } from '@/lib/utils';

import { formatElapsedDuration } from '../lib/workout-elapsed-duration';
import type { WorkoutHistoryNavigationState } from '../lib/workout-history-filters';
import { getWorkoutStatusLabel } from '../lib/workout-labels';
import {
  formatWorkoutReps,
  formatWorkoutVolume,
} from '../lib/workout-metrics-format';

type WorkoutHistoryRowProps = {
  item: WorkoutHistoryListItem;
  historySearch: string;
  pendingSync?: boolean;
  showDayHeading?: boolean;
  dayHeading?: string;
};

function formatListDuration(item: WorkoutHistoryListItem): string | null {
  const endIso = item.completedAt ?? item.cancelledAt;
  if (!endIso) return null;
  const start = Date.parse(item.startedAt);
  const end = Date.parse(endIso);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return formatElapsedDuration(end - start);
}

function buildMetaLine(item: WorkoutHistoryListItem): string {
  const parts: string[] = [];
  const duration = formatListDuration(item);
  if (duration) parts.push(duration);

  const { summary } = item;
  if (summary.exerciseCount > 0) {
    parts.push(
      `${summary.exerciseCount} exercice${summary.exerciseCount === 1 ? '' : 's'}`,
    );
  }
  if (summary.processedSetCount > 0 || summary.totalSetCount > 0) {
    parts.push(
      `${summary.processedSetCount}/${summary.totalSetCount} séries`,
    );
  }
  if (
    item.status === 'COMPLETED' &&
    summary.totalReps != null &&
    summary.totalReps > 0
  ) {
    parts.push(formatWorkoutReps(summary.totalReps));
  }
  if (
    item.status === 'COMPLETED' &&
    summary.workingExternalVolumeKg != null &&
    summary.workingExternalVolumeKg > 0
  ) {
    parts.push(formatWorkoutVolume(summary.workingExternalVolumeKg));
  }
  return parts.join(' · ');
}

export function WorkoutHistoryRow({
  item,
  historySearch,
  pendingSync = false,
  showDayHeading = false,
  dayHeading,
}: WorkoutHistoryRowProps) {
  const state: WorkoutHistoryNavigationState = {
    fromHistory: true,
    historySearch,
  };
  const meta = buildMetaLine(item);

  return (
    <li>
      {showDayHeading && dayHeading ? (
        <p className="mb-1 text-[0.6875rem] font-semibold tracking-[0.1em] text-[var(--muted)] uppercase">
          {dayHeading}
        </p>
      ) : null}
      <Link
        to={`/workouts/${item.id}`}
        state={state}
        className={cn(
          'flex min-h-14 items-center justify-between gap-3 py-2.5 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]',
        )}
        aria-label={`Ouvrir la séance ${item.name} du ${item.localDate}, ${getWorkoutStatusLabel(item.status)}`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="truncate text-sm font-semibold text-[var(--foreground)]">
              {item.name}
            </p>
            <span
              className={cn(
                'shrink-0 text-[0.6875rem] font-semibold tracking-wide uppercase',
                item.status === 'CANCELLED'
                  ? 'text-[var(--danger)]'
                  : 'text-[var(--muted)]',
              )}
            >
              {getWorkoutStatusLabel(item.status)}
            </span>
          </div>
          {pendingSync ? (
            <p className="mt-0.5 text-xs font-medium text-amber-700" role="status">
              En attente de synchronisation
            </p>
          ) : null}
          {meta ? (
            <p className="mt-0.5 truncate text-sm text-[var(--muted)]">{meta}</p>
          ) : null}
        </div>
        <ChevronRight
          className="size-4 shrink-0 text-[var(--muted)]"
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}

/** @deprecated Prefer WorkoutHistoryRow — alias pour compat tests/imports. */
export const WorkoutHistoryCard = WorkoutHistoryRow;
