import type { Weekday } from '@gym-companion/shared';

/** Ordre canonique des jours (aligné sur `@gym-companion/shared`). */
export const WEEKDAY_VALUES: Weekday[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  MONDAY: 'Lundi',
  TUESDAY: 'Mardi',
  WEDNESDAY: 'Mercredi',
  THURSDAY: 'Jeudi',
  FRIDAY: 'Vendredi',
  SATURDAY: 'Samedi',
  SUNDAY: 'Dimanche',
};

export const WEEKDAY_SHORT_LABELS: Record<Weekday, string> = {
  MONDAY: 'Lun',
  TUESDAY: 'Mar',
  WEDNESDAY: 'Mer',
  THURSDAY: 'Jeu',
  FRIDAY: 'Ven',
  SATURDAY: 'Sam',
  SUNDAY: 'Dim',
};

/** Jour local du device → Weekday API (lundi → dimanche). */
export function getTodayWeekday(date: Date = new Date()): Weekday {
  const jsDay = date.getDay(); // 0 = dimanche
  const map: Weekday[] = [
    'SUNDAY',
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
  ];
  return map[jsDay]!;
}

export function getWeekdayLabel(weekday: Weekday): string {
  return WEEKDAY_LABELS[weekday];
}

export function getWeekdayShortLabel(weekday: Weekday): string {
  return WEEKDAY_SHORT_LABELS[weekday];
}
