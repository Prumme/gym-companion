import type { WorkoutHistoryListItem } from '@gym-companion/shared';

import { todayLocalDateString } from '@/features/programs/lib/schedule-utils';

export type WorkoutHistoryGroup = {
  key: string;
  label: string;
  items: WorkoutHistoryListItem[];
};

function shiftLocalDate(localDate: string, days: number): string {
  const [y, m, d] = localDate.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  date.setUTCDate(date.getUTCDate() + days);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatMonthYearLabel(localDate: string): string {
  const [y, m, d] = localDate.split('-').map(Number);
  if (!y || !m || !d) return localDate;
  const date = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function formatDayMonthLabel(localDate: string): string {
  const [y, m, d] = localDate.split('-').map(Number);
  if (!y || !m || !d) return localDate;
  const date = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(date);
}

/** Libellé de groupe présentationnel (Aujourd’hui / Hier / mois). */
export function getHistoryGroupLabel(
  localDate: string,
  today: string = todayLocalDateString(),
): string {
  if (localDate === today) {
    return 'Aujourd’hui';
  }
  if (localDate === shiftLocalDate(today, -1)) {
    return 'Hier';
  }
  return formatMonthYearLabel(localDate);
}

/** Libellé de jour dans la timeline (ex. « 8 août »). */
export function formatHistoryDayHeading(localDate: string): string {
  return formatDayMonthLabel(localDate);
}

/**
 * Groupe les items déjà triés (localDate DESC) pour l’affichage timeline.
 * Ne modifie pas l’ordre ni les données métier.
 */
export function groupWorkoutHistoryItems(
  items: WorkoutHistoryListItem[],
  today: string = todayLocalDateString(),
): WorkoutHistoryGroup[] {
  const groups: WorkoutHistoryGroup[] = [];
  let current: WorkoutHistoryGroup | null = null;

  for (const item of items) {
    const label = getHistoryGroupLabel(item.localDate, today);
    const key =
      item.localDate === today || item.localDate === shiftLocalDate(today, -1)
        ? label
        : item.localDate.slice(0, 7);

    if (!current || current.key !== key) {
      current = { key, label, items: [] };
      groups.push(current);
    }
    current.items.push(item);
  }

  return groups;
}
