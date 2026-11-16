import { describe, expect, it } from 'vitest';

import {
  CARDIO_METRIC_FIELDS,
  cardioMetricFieldsFor,
} from '../lib/cardio-metric-fields';

describe('cardioMetricFieldsFor', () => {
  it('propose l’inclinaison sur tapis mais pas les étages', () => {
    const fields = cardioMetricFieldsFor('TREADMILL');
    expect(fields).toContain('inclinePercent');
    expect(fields).not.toContain('floorsClimbed');
  });

  it('propose la résistance et la cadence à vélo', () => {
    expect(cardioMetricFieldsFor('CYCLING')).toEqual([
      'averageHeartRate',
      'resistanceLevel',
      'cadenceSpm',
    ]);
  });

  it('affiche tout pour un type inconnu', () => {
    expect(cardioMetricFieldsFor(null)).toEqual([...CARDIO_METRIC_FIELDS]);
  });

  it('garde visible une métrique déjà enregistrée', () => {
    expect(
      cardioMetricFieldsFor('RUNNING', { inclinePercent: 2, floorsClimbed: null }),
    ).toEqual(['averageHeartRate', 'inclinePercent', 'cadenceSpm']);
  });
});
