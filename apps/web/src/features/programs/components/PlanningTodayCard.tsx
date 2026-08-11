import type { ProgramScheduleEntry, Weekday } from '@gym-companion/shared';

import { StartWorkoutButton } from '@/features/workouts/components/StartWorkoutButton';

import { getWeekdayLabel } from '../lib/weekdays';

type PlanningTodayCardProps = {
  weekday: Weekday;
  entries: ProgramScheduleEntry[];
};

function formatSessionMeta(entry: ProgramScheduleEntry): string {
  const parts: string[] = [];
  const count = entry.workoutTemplate.exerciseCount;
  parts.push(`${count} exercice${count === 1 ? '' : 's'}`);
  if (entry.workoutTemplate.estimatedDurationMinutes != null) {
    parts.push(`~${entry.workoutTemplate.estimatedDurationMinutes} min`);
  }
  return parts.join(' · ');
}

export function PlanningTodayCard({ weekday, entries }: PlanningTodayCardProps) {
  const dayLabel = getWeekdayLabel(weekday).toUpperCase();

  return (
    <section
      aria-labelledby="planning-today-heading"
      className="flex flex-col gap-3 border-b border-[var(--border)] pb-6"
    >
      <h2
        id="planning-today-heading"
        className="text-xs font-semibold tracking-[0.12em] text-[var(--muted)] uppercase"
      >
        Aujourd’hui · {dayLabel}
      </h2>

      {entries.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Aucune séance prévue.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-lg font-semibold text-[var(--foreground)]">
                  {entry.workoutTemplate.name}
                </p>
                <p className="mt-0.5 text-sm text-[var(--muted)]">
                  {formatSessionMeta(entry)}
                </p>
              </div>
              <StartWorkoutButton
                sourceWorkoutTemplateId={entry.workoutTemplate.id}
                label="Démarrer"
                className="w-full sm:w-auto"
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
