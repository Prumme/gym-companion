import type { CardioType } from '@gym-companion/shared';

/** Métriques cardio optionnelles d’une série (résultats, jamais obligatoires). */
export type CardioMetricField =
  | 'averageHeartRate'
  | 'inclinePercent'
  | 'resistanceLevel'
  | 'machineLevel'
  | 'floorsClimbed'
  | 'cadenceSpm';

export const CARDIO_METRIC_FIELDS: readonly CardioMetricField[] = [
  'averageHeartRate',
  'inclinePercent',
  'resistanceLevel',
  'machineLevel',
  'floorsClimbed',
  'cadenceSpm',
];

const FIELDS_BY_CARDIO_TYPE: Record<CardioType, readonly CardioMetricField[]> = {
  RUNNING: ['averageHeartRate', 'cadenceSpm'],
  WALKING: ['averageHeartRate', 'cadenceSpm'],
  TREADMILL: ['averageHeartRate', 'inclinePercent', 'cadenceSpm'],
  CYCLING: ['averageHeartRate', 'resistanceLevel', 'cadenceSpm'],
  ROWING: ['averageHeartRate', 'resistanceLevel', 'cadenceSpm'],
  ELLIPTICAL: ['averageHeartRate', 'resistanceLevel', 'machineLevel', 'cadenceSpm'],
  STAIR_CLIMBING: ['averageHeartRate', 'machineLevel', 'floorsClimbed'],
  OTHER: CARDIO_METRIC_FIELDS,
};

/**
 * Métriques à proposer pour une activité cardio. Un type inconnu (séance
 * antérieure au snapshot) affiche tout. Une métrique déjà renseignée reste
 * toujours visible pour ne jamais masquer une donnée enregistrée.
 */
export function cardioMetricFieldsFor(
  cardioType: CardioType | null | undefined,
  recorded: Partial<Record<CardioMetricField, number | null>> = {},
): CardioMetricField[] {
  const suggested = new Set(
    cardioType ? FIELDS_BY_CARDIO_TYPE[cardioType] : CARDIO_METRIC_FIELDS,
  );
  return CARDIO_METRIC_FIELDS.filter(
    (field) => suggested.has(field) || recorded[field] != null,
  );
}
