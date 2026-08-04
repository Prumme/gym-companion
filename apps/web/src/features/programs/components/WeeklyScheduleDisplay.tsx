import type { ProgramScheduleEntry } from '@gym-companion/shared';

import { StartWorkoutButton } from '@/features/workouts/components/StartWorkoutButton';

import { WEEKDAY_LABELS, WEEKDAY_VALUES } from '../lib/weekdays';

import { entriesForWeekday } from '../lib/schedule-utils';

type WeeklyScheduleDisplayProps = {
  entries: ProgramScheduleEntry[];
  showStartActions?: boolean;
};

function formatDuration(minutes: number | null): string | null {
  if (minutes == null) {
    return null;
  }
  return `${minutes} min`;
}

export function WeeklyScheduleDisplay({
  entries,
  showStartActions = false,
}: WeeklyScheduleDisplayProps) {
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
              <p className="mt-2 text-sm text-[var(--muted)]">Aucune séance</p>
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
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-medium">
                            {entry.workoutTemplate.name}
                          </p>
                          <p className="text-xs text-[var(--muted)]">
                            {entry.workoutTemplate.exerciseCount} exercice
                            {entry.workoutTemplate.exerciseCount === 1
                              ? ''
                              : 's'}
                            {duration ? ` · ${duration}` : ''}
                          </p>
                        </div>
                        {showStartActions ? (
                          <StartWorkoutButton
                            sourceWorkoutTemplateId={entry.workoutTemplate.id}
                            label="Démarrer cette séance"
                            className="w-full sm:w-auto"
                          />
                        ) : null}
                      </div>
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
