import { describe, expect, it } from 'vitest';

import {
  buildIntervalTemplateSets,
  formatIntervalDuration,
  summarizeIntervalSets,
  type IntervalPlan,
} from './cardio-intervals';
import { validateWorkoutTemplateSetTargets } from './index';

const plan: IntervalPlan = {
  rounds: 3,
  work: { durationSeconds: 60, speedKmh: 8, inclinePercent: null },
  recovery: { durationSeconds: 60, speedKmh: 4, inclinePercent: null },
  warmupSeconds: null,
  cooldownSeconds: null,
};

describe('buildIntervalTemplateSets', () => {
  it('alterne effort et récupération sans repos', () => {
    const sets = buildIntervalTemplateSets(plan);
    expect(sets.map((set) => set.setType)).toEqual([
      'INTERVAL_WORK',
      'INTERVAL_RECOVERY',
      'INTERVAL_WORK',
      'INTERVAL_RECOVERY',
      'INTERVAL_WORK',
      'INTERVAL_RECOVERY',
    ]);
    expect(sets.every((set) => set.restSeconds === 0)).toBe(true);
    expect(sets[0]).toMatchObject({ targetDurationSeconds: 60, targetSpeedKmh: 8 });
    expect(sets[1]).toMatchObject({ targetDurationSeconds: 60, targetSpeedKmh: 4 });
  });

  it('ajoute échauffement et retour au calme à allure de récup', () => {
    const sets = buildIntervalTemplateSets({
      ...plan,
      warmupSeconds: 300,
      cooldownSeconds: 180,
    });
    expect(sets[0]).toMatchObject({
      setType: 'WARMUP',
      targetDurationSeconds: 300,
      targetSpeedKmh: 4,
    });
    expect(sets.at(-1)).toMatchObject({
      setType: 'WORKING',
      targetDurationSeconds: 180,
      targetSpeedKmh: 4,
    });
    // pas de récup juste avant le retour au calme
    expect(sets.at(-2)?.setType).toBe('INTERVAL_WORK');
    expect(sets).toHaveLength(1 + 3 + 2 + 1);
  });

  it('produit des séries valides pour un exercice cardio', () => {
    for (const set of buildIntervalTemplateSets({ ...plan, warmupSeconds: 120 })) {
      expect(
        validateWorkoutTemplateSetTargets('DISTANCE_DURATION', set, { category: 'CARDIO' }),
      ).toEqual({ ok: true });
    }
  });

  it('refuse un plan hors bornes', () => {
    expect(() => buildIntervalTemplateSets({ ...plan, rounds: 0 })).toThrow();
    expect(() => buildIntervalTemplateSets({ ...plan, rounds: 21 })).toThrow();
  });
});

describe('summarizeIntervalSets', () => {
  it('résume un fractionné régulier', () => {
    expect(summarizeIntervalSets(buildIntervalTemplateSets(plan))).toBe(
      'Fractionné 3 × (1′ à 8 km/h / 1′ à 4 km/h)',
    );
  });

  it('reste générique si les phases varient', () => {
    const sets = buildIntervalTemplateSets(plan);
    sets[2] = { ...sets[2]!, targetDurationSeconds: 120 };
    expect(summarizeIntervalSets(sets)).toBe('Fractionné 3 × effort / récup');
  });

  it('renvoie null sans série d’effort', () => {
    expect(
      summarizeIntervalSets([{ setType: 'WORKING', targetDurationSeconds: 600 }]),
    ).toBeNull();
  });

  it('formate les durées courtes', () => {
    expect(formatIntervalDuration(45)).toBe('45″');
    expect(formatIntervalDuration(90)).toBe('1′30');
    expect(formatIntervalDuration(120)).toBe('2′');
  });
});

describe('validateWorkoutTemplateSetTargets — fractionné', () => {
  const base = {
    targetRepMin: null,
    targetRepMax: null,
    targetDurationSeconds: 60,
    targetDistanceMeters: null,
    targetWeightKg: null,
    targetIntensityPercent: null,
    targetRir: null,
    targetRpe: null,
    restSeconds: 0,
  };

  it('réserve le fractionné et la vitesse aux exercices cardio', () => {
    expect(
      validateWorkoutTemplateSetTargets('DURATION', { ...base, setType: 'INTERVAL_WORK' }).code,
    ).toBe('WORKOUT_TEMPLATE_SET_CARDIO_ONLY');
    expect(
      validateWorkoutTemplateSetTargets(
        'DURATION',
        { ...base, setType: 'WORKING', targetSpeedKmh: 8 },
        { category: 'STRENGTH' },
      ).code,
    ).toBe('WORKOUT_TEMPLATE_SET_CARDIO_ONLY');
  });

  it('exige une durée pour une série de fractionné', () => {
    expect(
      validateWorkoutTemplateSetTargets(
        'DISTANCE_DURATION',
        {
          ...base,
          setType: 'INTERVAL_RECOVERY',
          targetDurationSeconds: null,
          targetDistanceMeters: 200,
        },
        { category: 'CARDIO' },
      ).ok,
    ).toBe(false);
  });
});
