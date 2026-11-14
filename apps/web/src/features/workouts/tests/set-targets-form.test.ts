import { describe, expect, it } from 'vitest';

import { buildSetTargetsPatch, toSetTargetsFormValues } from '../lib/set-targets-form';
import { createWorkoutSet } from './fixtures';

const set = createWorkoutSet({
  targetWeightKg: 62.5,
  targetRepMin: 8,
  targetRepMax: 10,
  targetRestSeconds: 120,
});

describe('formulaire « Modifier la cible »', () => {
  it('pré-remplit avec les cibles actuelles (virgule décimale)', () => {
    expect(toSetTargetsFormValues(set)).toEqual({
      weightKg: '62,5',
      repMin: '8',
      repMax: '10',
      restSeconds: '120',
    });
  });

  it('n’envoie que les cibles modifiées', () => {
    const values = { ...toSetTargetsFormValues(set), weightKg: '65' };
    expect(buildSetTargetsPatch(set, 'WEIGHT_REPS', values)).toEqual({
      ok: true,
      patch: { targetWeightKg: 65 },
    });
  });

  it('recopie une borne de reps seule et envoie la paire', () => {
    const values = { ...toSetTargetsFormValues(set), repMin: '6', repMax: '' };
    expect(buildSetTargetsPatch(set, 'WEIGHT_REPS', values)).toEqual({
      ok: true,
      patch: { targetRepMin: 6, targetRepMax: 6 },
    });
  });

  it('efface une cible quand le champ est vidé', () => {
    const values = { ...toSetTargetsFormValues(set), restSeconds: '' };
    expect(buildSetTargetsPatch(set, 'WEIGHT_REPS', values)).toEqual({
      ok: true,
      patch: { targetRestSeconds: null },
    });
  });

  it('refuse un intervalle inversé, une valeur invalide ou aucune modification', () => {
    const base = toSetTargetsFormValues(set);
    expect(buildSetTargetsPatch(set, 'WEIGHT_REPS', { ...base, repMin: '12' })).toMatchObject({
      ok: false,
    });
    expect(buildSetTargetsPatch(set, 'WEIGHT_REPS', { ...base, weightKg: 'abc' })).toEqual({
      ok: false,
      message: 'Charge invalide.',
    });
    expect(
      buildSetTargetsPatch(set, 'WEIGHT_REPS', { ...base, restSeconds: '2000' }),
    ).toMatchObject({ ok: false });
    expect(buildSetTargetsPatch(set, 'WEIGHT_REPS', base)).toEqual({
      ok: false,
      message: 'Aucune cible modifiée.',
    });
  });

  it('ignore les champs non applicables au type de mesure', () => {
    const durationSet = createWorkoutSet({
      targetWeightKg: null,
      targetRepMin: null,
      targetRepMax: null,
      targetRestSeconds: 60,
    });
    const values = { weightKg: '20', repMin: '5', repMax: '5', restSeconds: '90' };
    expect(buildSetTargetsPatch(durationSet, 'DURATION', values)).toEqual({
      ok: true,
      patch: { targetRestSeconds: 90 },
    });
  });
});
