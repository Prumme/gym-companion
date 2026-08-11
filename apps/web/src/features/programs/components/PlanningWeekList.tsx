import type { ProgramScheduleEntry, Weekday } from '@gym-companion/shared';
import { ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

import {
  getWeekdayShortLabel,
  WEEKDAY_VALUES,
} from '../lib/weekdays';
import {
  entriesForWeekday,
  scheduleEntryToDraft,
} from '../lib/schedule-utils';

type PlanningWeekListProps = {
  entries: ProgramScheduleEntry[];
  todayWeekday: Weekday;
  canEdit: boolean;
  onSelectDay: (weekday: Weekday) => void;
};

export function PlanningWeekList({
  entries,
  todayWeekday,
  canEdit,
  onSelectDay,
}: PlanningWeekListProps) {
  const draftEntries = entries.map(scheduleEntryToDraft);

  return (
    <section aria-labelledby="planning-week-heading" className="flex flex-col gap-2">
      <h2
        id="planning-week-heading"
        className="text-xs font-semibold tracking-[0.12em] text-[var(--muted)] uppercase"
      >
        Semaine type
      </h2>

      <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
        {WEEKDAY_VALUES.map((weekday) => {
          const dayEntries = entriesForWeekday(draftEntries, weekday);
          const isToday = weekday === todayWeekday;
          const primary = dayEntries[0];
          const extraCount = Math.max(0, dayEntries.length - 1);
          const sessionLabel = primary
            ? extraCount > 0
              ? `${primary.workoutTemplate.name} (+${extraCount})`
              : primary.workoutTemplate.name
            : 'Repos';

          const content = (
            <>
              <span className="flex min-w-0 flex-1 items-baseline gap-3">
                <span
                  className={cn(
                    'w-9 shrink-0 text-sm tabular-nums',
                    isToday
                      ? 'font-semibold text-[var(--foreground)]'
                      : 'font-medium text-[var(--muted)]',
                  )}
                >
                  {getWeekdayShortLabel(weekday)}
                </span>
                <span
                  className={cn(
                    'min-w-0 truncate text-sm',
                    primary
                      ? 'font-medium text-[var(--foreground)]'
                      : 'text-[var(--muted)]',
                  )}
                >
                  {sessionLabel}
                </span>
                {isToday ? (
                  <span className="shrink-0 text-[0.6875rem] font-semibold tracking-wide text-[var(--muted)] uppercase">
                    Aujourd’hui
                  </span>
                ) : null}
              </span>
              {canEdit ? (
                <ChevronRight
                  className="size-4 shrink-0 text-[var(--muted)]"
                  aria-hidden="true"
                />
              ) : null}
            </>
          );

          return (
            <li key={weekday}>
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => onSelectDay(weekday)}
                  aria-label={`${getWeekdayShortLabel(weekday)} : ${sessionLabel}${isToday ? ', aujourd’hui' : ''}`}
                  className={cn(
                    'flex w-full min-h-11 items-center justify-between gap-2 px-1 py-2.5 text-left outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--ring)]',
                    isToday && 'bg-[var(--primary)]/10',
                  )}
                >
                  {content}
                </button>
              ) : (
                <div
                  className={cn(
                    'flex min-h-11 items-center justify-between gap-2 px-1 py-2.5',
                    isToday && 'bg-[var(--primary)]/10',
                  )}
                >
                  {content}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
