import { describe, expect, it } from 'vitest';

import { DEFAULT_BAR_WEIGHT_KG, DEFAULT_PLATES_KG } from '../lib/plate-calculator';
import { computeWarmupRamp, DEFAULT_WARMUP_STEPS } from '../lib/warmup-ramp';

const base = { barKg: DEFAULT_BAR_WEIGHT_KG, platesKg: DEFAULT_PLATES_KG };

function loads(workingKg: number | null, overrides: Partial<typeof base> = {}) {
  const result = computeWarmupRamp({ ...base, ...overrides, workingKg });
  return result.steps.map((step) => [step.percent, step.loadKg, step.reps]);
}

describe('computeWarmupRamp', () => {
  it('rampe par défaut : barre × 10, 40 % × 5, 60 % × 3, 80 % × 1', () => {
    expect(DEFAULT_WARMUP_STEPS).toHaveLength(4);
    expect(loads(100)).toEqual([
      [null, 20, 10],
      [40, 40, 5],
      [60, 60, 3],
      [80, 80, 1],
    ]);
  });

  it('expose les disques par côté de chaque palier', () => {
    const result = computeWarmupRamp({ ...base, workingKg: 100 });
    expect(result.steps[3]?.perSide).toEqual([
      { weightKg: 25, count: 1 },
      { weightKg: 5, count: 1 },
    ]);
    expect(result.steps[0]?.perSide).toEqual([]);
  });

  it('arrondit chaque palier à la charge chargeable inférieure', () => {
    expect(loads(62.5)).toEqual([
      [null, 20, 10],
      [40, 25, 5],
      [60, 37.5, 3],
      [80, 50, 1],
    ]);
    expect(loads(102.5)).toEqual([
      [null, 20, 10],
      [40, 40, 5],
      [60, 60, 3],
      [80, 80, 1],
    ]);
  });

  it('retire les paliers sous la barre', () => {
    expect(loads(30)).toEqual([
      [null, 20, 10],
      [80, 22.5, 1],
    ]);
  });

  it('retire les paliers en doublon après arrondi', () => {
    expect(loads(70, { platesKg: [10] })).toEqual([
      [null, 20, 10],
      [60, 40, 3],
    ]);
    expect(loads(70, { platesKg: [20] })).toEqual([[null, 20, 10]]);
  });

  it('n’est pas applicable sans charge de travail au-dessus de la barre', () => {
    expect(computeWarmupRamp({ ...base, workingKg: null })).toEqual({
      status: 'NOT_APPLICABLE',
      steps: [],
    });
    expect(computeWarmupRamp({ ...base, workingKg: 20 }).status).toBe('NOT_APPLICABLE');
    expect(computeWarmupRamp({ ...base, workingKg: 10 }).status).toBe('NOT_APPLICABLE');
    expect(computeWarmupRamp({ ...base, workingKg: Number.NaN }).status).toBe('NOT_APPLICABLE');
  });

  it('accepte des paliers personnalisés', () => {
    expect(
      computeWarmupRamp({
        ...base,
        workingKg: 100,
        steps: [{ kind: 'PERCENT', percent: 50, reps: 5 }],
      }).steps.map((step) => step.loadKg),
    ).toEqual([50]);
  });

  it('ne propose jamais un palier égal ou supérieur à la charge de travail', () => {
    for (let working = 21; working <= 200; working += 1.5) {
      for (const step of computeWarmupRamp({ ...base, workingKg: working }).steps) {
        if (step.percent != null) {
          expect(step.loadKg).toBeLessThan(working);
        }
      }
    }
  });
});
