import type {
  ProgramSchedule,
  ProgramScheduleEntry,
  ProgramScheduleTemplateRef,
  Weekday,
  WorkoutTemplateDetail,
} from '@gym-companion/shared';

import { WEEKDAY_VALUES } from './weekdays';

export type DraftScheduleEntry = {
  clientId: string;
  workoutTemplateId: string;
  weekday: Weekday;
  position: number;
  workoutTemplate: ProgramScheduleTemplateRef;
};

export function todayLocalDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function templateToScheduleRef(
  template: WorkoutTemplateDetail,
): ProgramScheduleTemplateRef {
  return {
    id: template.id,
    name: template.name,
    estimatedDurationMinutes: template.estimatedDurationMinutes,
    exerciseCount: template.exerciseCount,
  };
}

export function scheduleEntryToDraft(entry: ProgramScheduleEntry): DraftScheduleEntry {
  return {
    clientId: entry.id,
    workoutTemplateId: entry.workoutTemplate.id,
    weekday: entry.weekday,
    position: entry.position,
    workoutTemplate: entry.workoutTemplate,
  };
}

export function scheduleToDraftEntries(
  schedule: ProgramSchedule,
): DraftScheduleEntry[] {
  return schedule.entries.map(scheduleEntryToDraft);
}

export function reindexDraftEntries(
  entries: DraftScheduleEntry[],
): DraftScheduleEntry[] {
  const byWeekday = new Map<Weekday, DraftScheduleEntry[]>();
  for (const weekday of WEEKDAY_VALUES) {
    byWeekday.set(weekday, []);
  }
  for (const entry of entries) {
    byWeekday.get(entry.weekday)?.push(entry);
  }
  const next: DraftScheduleEntry[] = [];
  for (const weekday of WEEKDAY_VALUES) {
    const dayEntries = byWeekday.get(weekday) ?? [];
    dayEntries.sort((a, b) => a.position - b.position);
    dayEntries.forEach((entry, index) => {
      next.push({ ...entry, weekday, position: index });
    });
  }
  return next;
}

export function entriesForWeekday(
  entries: DraftScheduleEntry[],
  weekday: Weekday,
): DraftScheduleEntry[] {
  return entries
    .filter((entry) => entry.weekday === weekday)
    .sort((a, b) => a.position - b.position);
}

export function countScheduledSessions(entries: DraftScheduleEntry[]): number {
  return entries.length;
}

export function draftEntriesToReplaceInput(entries: DraftScheduleEntry[]) {
  return reindexDraftEntries(entries).map((entry) => ({
    workoutTemplateId: entry.workoutTemplateId,
    weekday: entry.weekday,
    position: entry.position,
  }));
}

export function moveDraftEntryWithinDay(
  entries: DraftScheduleEntry[],
  clientId: string,
  direction: 'up' | 'down',
): DraftScheduleEntry[] {
  const target = entries.find((entry) => entry.clientId === clientId);
  if (!target) {
    return entries;
  }
  const dayEntries = entriesForWeekday(entries, target.weekday);
  const index = dayEntries.findIndex((entry) => entry.clientId === clientId);
  if (index < 0) {
    return entries;
  }
  const swapIndex = direction === 'up' ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= dayEntries.length) {
    return entries;
  }
  const swapTarget = dayEntries[swapIndex]!;
  return reindexDraftEntries(
    entries.map((entry) => {
      if (entry.clientId === target.clientId) {
        return { ...entry, position: swapTarget.position };
      }
      if (entry.clientId === swapTarget.clientId) {
        return { ...entry, position: target.position };
      }
      return entry;
    }),
  );
}

export function changeDraftEntryWeekday(
  entries: DraftScheduleEntry[],
  clientId: string,
  weekday: Weekday,
): DraftScheduleEntry[] {
  const dayCount = entriesForWeekday(entries, weekday).length;
  return reindexDraftEntries(
    entries.map((entry) =>
      entry.clientId === clientId
        ? { ...entry, weekday, position: dayCount }
        : entry,
    ),
  );
}

export function removeDraftEntry(
  entries: DraftScheduleEntry[],
  clientId: string,
): DraftScheduleEntry[] {
  return reindexDraftEntries(
    entries.filter((entry) => entry.clientId !== clientId),
  );
}

export function addDraftEntry(
  entries: DraftScheduleEntry[],
  weekday: Weekday,
  template: WorkoutTemplateDetail,
): DraftScheduleEntry[] {
  const dayCount = entriesForWeekday(entries, weekday).length;
  const nextEntry: DraftScheduleEntry = {
    clientId: `draft-${crypto.randomUUID()}`,
    workoutTemplateId: template.id,
    weekday,
    position: dayCount,
    workoutTemplate: templateToScheduleRef(template),
  };
  return reindexDraftEntries([...entries, nextEntry]);
}

/**
 * Remplace toutes les entrées d’un jour par une seule séance (ou aucune).
 * Préserve les autres jours — adapté au sheet d’édition jour (UX-5).
 */
export function setDraftDaySingleTemplate(
  entries: DraftScheduleEntry[],
  weekday: Weekday,
  template: WorkoutTemplateDetail | null,
): DraftScheduleEntry[] {
  const withoutDay = entries.filter((entry) => entry.weekday !== weekday);
  if (!template) {
    return reindexDraftEntries(withoutDay);
  }
  return addDraftEntry(withoutDay, weekday, template);
}

export function draftEntriesEqual(
  left: DraftScheduleEntry[],
  right: DraftScheduleEntry[],
): boolean {
  const normalizedLeft = reindexDraftEntries(left);
  const normalizedRight = reindexDraftEntries(right);
  if (normalizedLeft.length !== normalizedRight.length) {
    return false;
  }
  return normalizedLeft.every((entry, index) => {
    const other = normalizedRight[index]!;
    return (
      entry.workoutTemplateId === other.workoutTemplateId &&
      entry.weekday === other.weekday &&
      entry.position === other.position
    );
  });
}
