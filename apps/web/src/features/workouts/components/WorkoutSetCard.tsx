import type { WorkoutSessionSetDetail } from '@gym-companion/shared';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import {
  formatWorkoutSetActualSummary,
  formatWorkoutSetTargetSummary,
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

export function WorkoutSetCard({
  set,
  canRecord,
  isNext,
  onEdit,
  onSkip,
  onMarkFailed,
}: WorkoutSetCardProps) {
  const targetParts = formatWorkoutSetTargetSummary(set).split(' — ').slice(1);
  const actual = formatWorkoutSetActualSummary(set);

  return (
    <li
      id={`set-${set.id}`}
      className={cn(
        'rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-3 py-3',
        isNext ? 'ring-2 ring-[var(--primary)] ring-offset-2' : '',
      )}
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">
            Série {set.position + 1} · {getWorkoutSetTypeLabelSafe(set.setType)}
          </p>
          {isNext ? (
            <span className="text-xs font-medium text-[var(--primary)]">
              Prochaine série
            </span>
          ) : null}
        </div>
        <p className="text-xs text-[var(--muted)]">
          Cible : {targetParts.join(' — ') || '—'}
        </p>
        <p className="text-xs">
          Statut :{' '}
          {!canRecord && set.status === 'PENDING'
            ? 'Non réalisée'
            : getWorkoutSetStatusLabel(set.status)}
        </p>
        {set.reachedFailure ? (
          <p className="text-xs text-[var(--muted)]">Échec musculaire : Oui</p>
        ) : set.status !== 'PENDING' && set.status !== 'SKIPPED' ? (
          <p className="text-xs text-[var(--muted)]">Échec musculaire : Non</p>
        ) : null}
        {set.notes ? (
          <p className="text-xs text-[var(--muted)]">Notes : {set.notes}</p>
        ) : null}
        {set.completedAt ? (
          <p className="text-xs text-[var(--muted)]">
            Validée :{' '}
            {new Intl.DateTimeFormat('fr-FR', {
              dateStyle: 'short',
              timeStyle: 'short',
            }).format(new Date(set.completedAt))}
          </p>
        ) : null}
        {actual ? <p className="text-sm">Réalisé : {actual}</p> : null}
        {set.targetRestSeconds != null && set.targetRestSeconds > 0 ? (
          <p className="text-xs text-[var(--muted)]">
            Repos après : {set.targetRestSeconds} s
          </p>
        ) : null}

        {canRecord ? (
          <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={onEdit}
            >
              {set.status === 'PENDING' ? 'Saisir la série' : 'Modifier'}
            </Button>
            {set.status === 'PENDING' && onSkip ? (
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={onSkip}
              >
                Ignorer
              </Button>
            ) : null}
            {set.status === 'PENDING' && onMarkFailed ? (
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={onMarkFailed}
              >
                Marquer comme échouée
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}
