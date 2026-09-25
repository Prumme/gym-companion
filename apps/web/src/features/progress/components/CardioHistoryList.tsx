import type { CardioHistoryEntry } from '@gym-companion/shared';
import {
  formatDistanceMeters,
  formatDuration,
  formatPace,
} from '@gym-companion/validation';

function formatLocalDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) {
    return value;
  }
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
  }).format(new Date(year, month - 1, day));
}

type CardioHistoryListProps = {
  entries: CardioHistoryEntry[];
};

export function CardioHistoryList({ entries }: CardioHistoryListProps) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Aucune séance cardio enregistrée pour cet exercice.
      </p>
    );
  }

  return (
    <section aria-label="Historique cardio" className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">Historique</h2>
      <ul className="flex flex-col gap-2">
        {entries.map((entry) => {
          const distance = formatDistanceMeters(entry.distanceMeters);
          const duration = formatDuration(entry.durationSeconds);
          const pace = formatPace(entry.averagePaceSecondsPerKm);
          const summary = [duration, distance, pace].filter(Boolean).join(' · ');
          return (
            <li
              key={entry.workoutSessionId}
              className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-3"
            >
              <p className="text-sm font-medium">{formatLocalDate(entry.localDate)}</p>
              <p className="mt-1 text-base tabular-nums">{summary || '—'}</p>
              {entry.sessionRpe != null ? (
                <p className="mt-1 text-sm text-[var(--muted)]">RPE {entry.sessionRpe}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
