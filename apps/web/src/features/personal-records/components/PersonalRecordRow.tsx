import type { PersonalRecord } from '@gym-companion/shared';
import { Link } from 'react-router-dom';

import { cn } from '@/lib/utils';

import {
  formatPersonalRecordContext,
  formatPersonalRecordDate,
  formatPersonalRecordValue,
  getPersonalRecordTypeLabel,
} from '../lib/personal-record-labels';

type PersonalRecordRowProps = {
  record: PersonalRecord;
  /** Affiche le nom de l’exercice (liste globale). */
  showExerciseName?: boolean;
  className?: string;
};

function compactContextParts(record: PersonalRecord): string[] {
  return formatPersonalRecordContext(record)
    .filter((part) => {
      const lower = part.toLowerCase();
      return (
        lower.includes('répétition') ||
        lower.includes('kg') ||
        lower.includes('rir') ||
        lower.includes('rpe') ||
        lower.includes(' min') ||
        lower.includes(' s') ||
        lower.endsWith(' m')
      );
    })
    .slice(0, 2);
}

/** Ligne compacte pour listes Records / overview (UX-4). */
export function PersonalRecordRow({
  record,
  showExerciseName = true,
  className,
}: PersonalRecordRowProps) {
  const valueLabel = formatPersonalRecordValue(record);
  const typeLabel = getPersonalRecordTypeLabel(record.recordType);
  const detailParts = [
    valueLabel,
    ...compactContextParts(record),
    ...(record.equipment.name ? [record.equipment.name] : []),
  ];

  return (
    <li className={cn('border-b border-[var(--border)] last:border-b-0', className)}>
      <div className="flex min-h-14 items-center gap-2 py-2.5">
        <Link
          to={`/progress/exercises/${record.exerciseId}`}
          className="min-w-0 flex-1 rounded-[var(--radius-control)] text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          aria-label={`${showExerciseName ? record.exercise.name : typeLabel} : ${valueLabel}`}
        >
          {showExerciseName ? (
            <p className="truncate font-semibold tracking-tight">
              {record.exercise.name}
            </p>
          ) : (
            <p className="truncate text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              {typeLabel}
            </p>
          )}
          <p className="mt-0.5 text-sm tabular-nums">
            <span className="font-semibold">{detailParts[0]}</span>
            {detailParts.length > 1 ? (
              <span className="text-[var(--muted)]">
                {' '}
                · {detailParts.slice(1).join(' · ')}
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            {formatPersonalRecordDate(record.achievedOn)}
            {showExerciseName ? ` · ${typeLabel}` : ''}
          </p>
        </Link>
        <Link
          to={`/progress/exercises/${record.exerciseId}`}
          className="inline-flex min-h-11 shrink-0 items-center text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
          tabIndex={-1}
          aria-hidden="true"
        >
          Voir →
        </Link>
      </div>
    </li>
  );
}
