import type { SharedWorkoutRoomMemberDto } from '@gym-companion/shared';
import { safeProgressRatio } from '@gym-companion/validation';

import { cn } from '@/lib/utils';

import { formatSharedSetProgress } from '../lib/shared-workout-labels';
import { SharedPresenceDot } from './SharedPresenceDot';

type SharedParticipantRowProps = {
  member: SharedWorkoutRoomMemberDto;
  online: boolean | null;
  showProgress: boolean;
};

function statusExtraLabel(status: string): string | null {
  if (status === 'PAUSED') return 'En pause';
  if (status === 'COMPLETED') return 'Terminée';
  if (status === 'CANCELLED') return 'Annulée';
  return null;
}

export function SharedParticipantRow({
  member,
  online,
  showProgress,
}: SharedParticipantRowProps) {
  const workout = member.memberWorkout;
  const progress = workout.progress;
  const current = workout.currentExercise;
  const ratio =
    progress && progress.totalSetCount > 0
      ? safeProgressRatio(progress.processedSetCount, progress.totalSetCount)
      : 0;
  const percent = Math.round(ratio * 100);
  const statusExtra = statusExtraLabel(workout.status);

  return (
    <li className="flex flex-col gap-1.5 border-b border-[var(--border)] py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--foreground)]">
            {member.displayName ?? 'Participant'}
            {member.role === 'OWNER' ? (
              <span className="ml-2 text-[0.6875rem] font-medium tracking-wide text-[var(--muted)] uppercase">
                Hôte
              </span>
            ) : null}
          </p>
          {showProgress && current ? (
            <p className="mt-0.5 truncate text-sm text-[var(--foreground)]">
              {current.name}
            </p>
          ) : null}
          {showProgress &&
          !current &&
          (workout.status === 'ACTIVE' || workout.status === 'PAUSED') ? (
            <p className="mt-0.5 text-sm text-[var(--muted)]">
              Aucun exercice sélectionné
            </p>
          ) : null}
          {!showProgress ? (
            <p className="mt-0.5 text-sm text-[var(--muted)]">
              {online === true
                ? 'En ligne'
                : online === false
                  ? 'Hors ligne'
                  : 'Présence inconnue'}
            </p>
          ) : null}
          {statusExtra ? (
            <p className="text-xs text-[var(--muted)]">{statusExtra}</p>
          ) : null}
        </div>
        <SharedPresenceDot online={online} />
      </div>

      {showProgress && progress && progress.totalSetCount > 0 ? (
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2 text-sm text-[var(--muted)]">
            <span>
              {formatSharedSetProgress(
                progress.processedSetCount,
                progress.totalSetCount,
              )}
            </span>
            <span className="tabular-nums">{percent} %</span>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-[var(--border)]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-label={`Progression ${percent} pour cent`}
          >
            <div
              className={cn('h-full rounded-full bg-[var(--primary)]')}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      ) : null}
    </li>
  );
}
