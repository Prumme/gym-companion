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

export function getWeekdayLabel(weekday: Weekday): string {
  return WEEKDAY_LABELS[weekday];
}
