import type { ProgramScheduleEntry } from '@gym-companion/shared';

import { WEEKDAY_LABELS, WEEKDAY_VALUES } from '../lib/weekdays';

import { entriesForWeekday } from '../lib/schedule-utils';

type WeeklyScheduleDisplayProps = {
  entries: ProgramScheduleEntry[];
};

function formatDuration(minutes: number | null): string | null {
  if (minutes == null) {
    return null;
  }
  return `${minutes} min`;
}

export function WeeklyScheduleDisplay({ entries }: WeeklyScheduleDisplayProps) {
  return (
    <div className="flex flex-col gap-3">
      {WEEKDAY_VALUES.map((weekday) => {
        const dayEntries = entriesForWeekday(
          entries.map((entry) => ({
            clientId: entry.id,
            workoutTemplateId: entry.workoutTemplate.id,
            weekday: entry.weekday,
            position: entry.position,
            workoutTemplate: entry.workoutTemplate,
          })),
          weekday,
        );

        return (
          <section
            key={weekday}
            className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3"
          >
            <h3 className="text-sm font-semibold">{WEEKDAY_LABELS[weekday]}</h3>
            {dayEntries.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--muted)]">Repos</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {dayEntries.map((entry) => {
                  const duration = formatDuration(
                    entry.workoutTemplate.estimatedDurationMinutes,
                  );
                  return (
                    <li
                      key={entry.clientId}
                      className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                    >
                      <p className="text-sm font-medium">
                        {entry.workoutTemplate.name}
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        {entry.workoutTemplate.exerciseCount} exercice
                        {entry.workoutTemplate.exerciseCount === 1 ? '' : 's'}
                        {duration ? ` · ${duration}` : ''}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
