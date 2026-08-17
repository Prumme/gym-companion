import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { normalizeExerciseName } from '@gym-companion/validation';

import { SYSTEM_EXERCISE_SEEDS } from './exercises.seed';
import referenceData from '../reference/reference-seed-data.json';

const MEASUREMENT_TYPES = new Set([
  'WEIGHT_REPS',
  'BODYWEIGHT_REPS',
  'ASSISTED_BODYWEIGHT_REPS',
  'REPS_ONLY',
  'DURATION',
  'DISTANCE_DURATION',
  'WEIGHT_DURATION',
]);

const REQUIRED_NAME_SNIPPETS = [
  'Presse à cuisses',
  'Leg Extension',
  'Leg Curl assis',
  'Leg Curl allongé',
  'Hack Squat',
  'Hip Thrust machine',
  'Chest Press machine',
  'Pec Deck',
  'Tirage vertical',
  'Rowing assis',
  'Shoulder Press machine',
  'Élévations latérales',
  'Reverse Pec Deck',
  'Curl avec haltères',
  'Curl marteau',
  'Curl pupitre',
  'Curl poulie',
  'Extension triceps',
  'Extension triceps poulie corde',
  'Dips assistés',
  'Tractions assistées',
  'Développé couché',
  'Développé incliné',
  'Squat',
  'Soulevé de terre roumain',
  'Mollets',
  'Crunch machine',
  'Crunch poulie',
  'Planche',
] as const;

/** Séance « Débutant — Full Body A » : chaque ligne = un match obligatoire. */
const SESSION_A_MATCHERS: Array<(name: string) => boolean> = [
  (n) => /presse à cuisses/i.test(n) && !/horizontale|unilatérale|45/i.test(n),
  (n) => /chest press machine/i.test(n),
  (n) => /tirage vertical/i.test(n),
  (n) => /leg curl/i.test(n),
  (n) => /rowing assis/i.test(n),
  (n) => /élévations latérales/i.test(n),
  (n) => /curl/i.test(n) && /biceps|haltères|marteau|poulie|pupitre/i.test(n),
  (n) => /extension triceps/i.test(n) && /poulie/i.test(n),
];

describe('SYSTEM exercise seed dataset', () => {
  const muscleCodes = new Set(referenceData.muscleGroups.map((item) => item.code));
  const equipmentCodes = new Set(
    referenceData.equipmentTypes.map((item) => item.code),
  );

  it('contient un catalogue SYSTEM large (≥ 100)', () => {
    expect(SYSTEM_EXERCISE_SEEDS.length).toBeGreaterThanOrEqual(100);
    expect(SYSTEM_EXERCISE_SEEDS.length).toBeLessThanOrEqual(200);
  });

  it('n’a ni slug ni nom normalisé dupliqué', () => {
    const slugs = SYSTEM_EXERCISE_SEEDS.map((item) => item.slug);
    const norms = SYSTEM_EXERCISE_SEEDS.map((item) =>
      normalizeExerciseName(item.name),
    );
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(norms).size).toBe(norms.length);
  });

  it('référence uniquement MuscleGroups / EquipmentTypes / measurementTypes valides', () => {
    for (const item of SYSTEM_EXERCISE_SEEDS) {
      expect(muscleCodes.has(item.primaryMuscleCode)).toBe(true);
      for (const code of item.secondaryMuscleCodes) {
        expect(muscleCodes.has(code)).toBe(true);
      }
      expect(equipmentCodes.has(item.defaultEquipmentCode)).toBe(true);
      for (const code of item.compatibleEquipmentCodes) {
        expect(equipmentCodes.has(code)).toBe(true);
      }
      expect(
        item.compatibleEquipmentCodes.includes(item.defaultEquipmentCode),
      ).toBe(true);
      expect(MEASUREMENT_TYPES.has(item.measurementType)).toBe(true);
    }
  });

  it('couvre les exercices machine / classiques prioritaires', () => {
    const names = SYSTEM_EXERCISE_SEEDS.map((item) => item.name);
    for (const snippet of REQUIRED_NAME_SNIPPETS) {
      expect(
        names.some((name) =>
          name.toLowerCase().includes(snippet.toLowerCase()),
        ),
        `missing snippet: ${snippet}`,
      ).toBe(true);
    }
  });

  it('permet de construire la séance Débutant Full Body A', () => {
    const names = SYSTEM_EXERCISE_SEEDS.map((item) => item.name);
    for (const matcher of SESSION_A_MATCHERS) {
      expect(names.some(matcher)).toBe(true);
    }
  });

  it('reste synchronisé avec le JSON source', () => {
    const raw = JSON.parse(
      readFileSync(resolve(__dirname, './exercises-seed-data.json'), 'utf8'),
    ) as unknown[];
    expect(raw).toHaveLength(SYSTEM_EXERCISE_SEEDS.length);
  });
});
