import { describe, expect, it } from 'vitest';

import {
  getMeasurementTypeLabel,
  MEASUREMENT_TYPE_LABELS,
} from '../lib/exercise-labels';

describe('exercise measurement labels', () => {
  it('maps every measurement type to a French label', () => {
    expect(getMeasurementTypeLabel('WEIGHT_REPS')).toBe('Poids et répétitions');
    expect(getMeasurementTypeLabel('BODYWEIGHT_REPS')).toBe(
      'Poids du corps et répétitions',
    );
    expect(getMeasurementTypeLabel('ASSISTED_BODYWEIGHT_REPS')).toBe(
      'Assistance et répétitions',
    );
    expect(getMeasurementTypeLabel('REPS_ONLY')).toBe('Répétitions');
    expect(getMeasurementTypeLabel('DURATION')).toBe('Durée');
    expect(getMeasurementTypeLabel('DISTANCE_DURATION')).toBe('Distance et durée');
    expect(getMeasurementTypeLabel('WEIGHT_DURATION')).toBe('Poids et durée');
    expect(Object.keys(MEASUREMENT_TYPE_LABELS)).toHaveLength(7);
  });
});
