import type { WorkoutSessionSetDetail } from '@gym-companion/shared';

import { cn } from '@/lib/utils';

import {
  formatWorkoutSetActualCompact,
  formatWorkoutSetTargetCompact,
  getWorkoutSetStatusLabel,
  getWorkoutSetTypeLabelSafe,
} from '../lib/workout-labels';

type WorkoutSetCardProps = {
  set: WorkoutSessionSetDetail;
  canRecord: boolean;
  isNext: boolean;
  onEdit: () => void;
  onSkip?: () => void;
  onMarkFailed?: () => void;
};

function statusGlyph(set: WorkoutSessionSetDetail, isNext: boolean): string {
  if (set.status === 'SKIPPED' || set.status === 'CANCELLED') return '—';
  if (
    set.status === 'COMPLETED' ||
    set.status === 'PARTIAL' ||
    set.status === 'FAILED'
  ) {
    return '✓';
  }
  if (isNext) return '●';
  return '○';
}

export function WorkoutSetCard({
  set,
  canRecord,
  isNext,
  onEdit,
}: WorkoutSetCardProps) {
  const actual = formatWorkoutSetActualCompact(set);
  const target = formatWorkoutSetTargetCompact(set);
  const glyph = statusGlyph(set, isNext);
  const statusLabel =
    !canRecord && set.status === 'PENDING'
      ? 'Non réalisée'
      : getWorkoutSetStatusLabel(set.status);
  const detail =
    set.status === 'PENDING' || set.status === 'SKIPPED'
      ? target || '—'
      : actual || target || statusLabel;

  const interactive = canRecord;

  return (
    <li id={`set-${set.id}`}>
      <button
        type="button"
        disabled={!interactive}
        onClick={onEdit}
        aria-current={isNext ? 'step' : undefined}
        aria-label={`Série ${set.position + 1}, ${getWorkoutSetTypeLabelSafe(set.setType)}, ${statusLabel}${isNext ? ', série courante' : ''}`}
        className={cn(
          'flex w-full min-h-11 items-center gap-3 rounded-[var(--radius-control)] px-2 py-2 text-left transition-colors',
          interactive
            ? 'hover:bg-[var(--surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]'
            : 'cursor-default opacity-90',
          isNext
            ? 'bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/50'
            : '',
        )}
      >
        <span
          className={cn(
            'w-4 shrink-0 text-center text-sm font-semibold',
            isNext
              ? 'text-[var(--primary-foreground)]'
              : set.status === 'PENDING'
                ? 'text-[var(--muted)]'
                : set.status === 'SKIPPED' || set.status === 'CANCELLED'
                  ? 'text-[var(--muted)]'
                  : 'text-[var(--foreground)]',
          )}
          aria-hidden="true"
        >
          {glyph}
        </span>
        <span className="w-5 shrink-0 text-sm font-medium tabular-nums text-[var(--muted)]">
          {set.position + 1}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm tabular-nums">
          {detail}
        </span>
        {isNext ? (
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[var(--primary-foreground)]">
            Courante
          </span>
        ) : set.status !== 'PENDING' ? (
          <span className="sr-only">{statusLabel}</span>
        ) : null}
      </button>
    </li>
  );
}
