import { describe, expect, it } from 'vitest';

import {
  DEFAULT_BAR_WEIGHT_KG,
  DEFAULT_PLATES_KG,
  calculatePlates,
  formatPlatesPerSide,
  isBarbellEquipmentCode,
  parseKgInput,
  resolvePlateCalculatorTargetKg,
  roundDownToLoadableKg,
  supportsPlateCalculator,
} from '../lib/plate-calculator';
import {
  defaultPlateSettings,
  normalizePlateList,
  parsePlateSettings,
  PLATE_SETTINGS_STORAGE_KEY,
  readPlateSettings,
  togglePlate,
  writePlateSettings,
} from '../lib/plate-settings-storage';
import { createWorkoutSet } from './fixtures';

const defaults = { barKg: DEFAULT_BAR_WEIGHT_KG, plates: DEFAULT_PLATES_KG };

describe('calculatePlates', () => {
  it('valeurs par défaut V1 : barre 20 kg, 25/20/15/10/5/2,5/1,25', () => {
    expect(DEFAULT_BAR_WEIGHT_KG).toBe(20);
    expect(DEFAULT_PLATES_KG).toEqual([25, 20, 15, 10, 5, 2.5, 1.25]);
  });

  it('charge exacte : glouton du plus lourd au plus léger', () => {
    expect(calculatePlates({ ...defaults, targetKg: 100 })).toEqual({
      status: 'EXACT',
      perSide: [
        { weightKg: 25, count: 1 },
        { weightKg: 15, count: 1 },
      ],
      achievableKg: 100,
      differenceKg: 0,
    });
  });

  it('empile plusieurs disques identiques', () => {
    expect(calculatePlates({ ...defaults, targetKg: 140 }).perSide).toEqual([
      { weightKg: 25, count: 2 },
      { weightKg: 10, count: 1 },
    ]);
  });

  it('gère les décimales sans erreur de flottant', () => {
    const result = calculatePlates({ ...defaults, targetKg: 47.5 });
    expect(result.status).toBe('EXACT');
    expect(result.perSide).toEqual([
      { weightKg: 10, count: 1 },
      { weightKg: 2.5, count: 1 },
      { weightKg: 1.25, count: 1 },
    ]);
    expect(result.achievableKg).toBe(47.5);
    expect(calculatePlates({ ...defaults, targetKg: 62.5 })).toMatchObject({
      status: 'EXACT',
      achievableKg: 62.5,
    });
    expect(calculatePlates({ ...defaults, targetKg: 22.5 }).perSide).toEqual([
      { weightKg: 1.25, count: 1 },
    ]);
  });

  it('cible non atteignable : charge inférieure et écart', () => {
    expect(calculatePlates({ ...defaults, targetKg: 61.25 })).toEqual({
      status: 'APPROXIMATE',
      perSide: [{ weightKg: 20, count: 1 }],
      achievableKg: 60,
      differenceKg: 1.25,
    });
    expect(calculatePlates({ ...defaults, targetKg: 20.3 })).toMatchObject({
      status: 'APPROXIMATE',
      perSide: [],
      achievableKg: 20,
      differenceKg: 0.3,
    });
  });

  it('arrondit au gramme inférieur une charge par côté impaire', () => {
    expect(calculatePlates({ ...defaults, targetKg: 20.001 })).toMatchObject({
      status: 'APPROXIMATE',
      achievableKg: 20,
      differenceKg: 0.001,
    });
  });

  it('cible égale à la barre : aucun disque', () => {
    expect(calculatePlates({ ...defaults, targetKg: 20 })).toEqual({
      status: 'EXACT',
      perSide: [],
      achievableKg: 20,
      differenceKg: 0,
    });
  });

  it('cible inférieure à la barre', () => {
    expect(calculatePlates({ ...defaults, targetKg: 15 })).toEqual({
      status: 'BELOW_BAR',
      perSide: [],
      achievableKg: 20,
      differenceKg: -5,
    });
  });

  it('respecte un nombre de paires limité', () => {
    expect(
      calculatePlates({
        targetKg: 100,
        barKg: 20,
        plates: [{ weightKg: 20, pairs: 1 }, { weightKg: 5 }],
      }),
    ).toMatchObject({
      status: 'EXACT',
      perSide: [
        { weightKg: 20, count: 1 },
        { weightKg: 5, count: 4 },
      ],
    });
    expect(
      calculatePlates({ targetKg: 60, barKg: 20, plates: [{ weightKg: 20, pairs: 0 }] }),
    ).toMatchObject({ status: 'APPROXIMATE', achievableKg: 20, differenceKg: 40 });
  });

  it('trie, dédoublonne et ignore les disques invalides', () => {
    expect(
      calculatePlates({ targetKg: 80, barKg: 20, plates: [5, 25, 25, 0, -1, Number.NaN] }),
    ).toMatchObject({
      status: 'EXACT',
      perSide: [
        { weightKg: 25, count: 1 },
        { weightKg: 5, count: 1 },
      ],
    });
  });

  it('sans disque ou disques trop lourds : barre seule et écart', () => {
    expect(calculatePlates({ targetKg: 100, barKg: 20, plates: [] })).toMatchObject({
      status: 'APPROXIMATE',
      achievableKg: 20,
      differenceKg: 80,
    });
    expect(calculatePlates({ targetKg: 60, barKg: 20, plates: [25] })).toMatchObject({
      status: 'APPROXIMATE',
      achievableKg: 20,
      differenceKg: 40,
    });
  });

  it('documente la limite du glouton (pas de recherche optimale)', () => {
    // 20 kg par côté avec 15 et 10 : le glouton prend 15 puis ne peut plus rien ajouter.
    expect(calculatePlates({ targetKg: 60, barKg: 20, plates: [15, 10] })).toMatchObject({
      status: 'APPROXIMATE',
      achievableKg: 50,
      differenceKg: 10,
    });
  });

  it('barre personnalisée (15 kg)', () => {
    expect(calculatePlates({ targetKg: 40, barKg: 15, plates: DEFAULT_PLATES_KG })).toMatchObject({
      status: 'EXACT',
      perSide: [
        { weightKg: 10, count: 1 },
        { weightKg: 2.5, count: 1 },
      ],
    });
  });

  it('refuse les entrées invalides', () => {
    expect(calculatePlates({ ...defaults, targetKg: Number.NaN }).status).toBe('INVALID');
    expect(calculatePlates({ ...defaults, targetKg: -10 }).status).toBe('INVALID');
    expect(calculatePlates({ targetKg: 60, barKg: -1, plates: [] }).status).toBe('INVALID');
    expect(roundDownToLoadableKg({ ...defaults, targetKg: Number.POSITIVE_INFINITY })).toBe(0);
  });

  it('roundDownToLoadableKg ne dépasse jamais la cible au-dessus de la barre', () => {
    for (let target = 20; target <= 200; target += 0.75) {
      expect(roundDownToLoadableKg({ ...defaults, targetKg: target })).toBeLessThanOrEqual(
        target + 1e-9,
      );
    }
  });
});

describe('helpers du calculateur', () => {
  it('formate les disques par côté', () => {
    expect(
      formatPlatesPerSide([
        { weightKg: 20, count: 2 },
        { weightKg: 2.5, count: 1 },
      ]),
    ).toBe('2 × 20 kg + 2,5 kg');
    expect(formatPlatesPerSide([])).toBe('Aucun disque');
  });

  it('parse une saisie avec virgule ou point', () => {
    expect(parseKgInput('82,5')).toBe(82.5);
    expect(parseKgInput(' 60.25 ')).toBe(60.25);
    expect(parseKgInput('')).toBeNull();
    expect(parseKgInput('abc')).toBeNull();
    expect(parseKgInput('-5')).toBeNull();
  });

  it('identifie la barre par le code d’équipement', () => {
    expect(isBarbellEquipmentCode('barbell')).toBe(true);
    expect(isBarbellEquipmentCode('BARBELL')).toBe(true);
    expect(isBarbellEquipmentCode('dumbbell')).toBe(false);
    expect(isBarbellEquipmentCode(null)).toBe(false);
  });

  it('ne propose le calculateur que pour WEIGHT_REPS sur barre', () => {
    const barbell = { id: 'eq', code: 'barbell', name: 'Barre' };
    expect(supportsPlateCalculator({ measurementType: 'WEIGHT_REPS', equipment: barbell })).toBe(
      true,
    );
    expect(
      supportsPlateCalculator({ measurementType: 'WEIGHT_DURATION', equipment: barbell }),
    ).toBe(false);
    expect(
      supportsPlateCalculator({
        measurementType: 'WEIGHT_REPS',
        equipment: { id: 'eq', code: 'machine', name: 'Machine' },
      }),
    ).toBe(false);
  });

  it('pré-remplit avec la cible, puis la saisie, puis la dernière charge saisie', () => {
    const next = createWorkoutSet({
      id: 'b',
      position: 1,
      targetWeightKg: 80,
      actualWeightKg: null,
    });
    expect(resolvePlateCalculatorTargetKg([next], next)).toBe(80);

    const noTarget = createWorkoutSet({
      id: 'b',
      position: 1,
      targetWeightKg: null,
      actualWeightKg: 70,
    });
    expect(resolvePlateCalculatorTargetKg([noTarget], noTarget)).toBe(70);

    const done = createWorkoutSet({
      id: 'a',
      position: 0,
      targetWeightKg: null,
      actualWeightKg: 65,
    });
    const empty = createWorkoutSet({
      id: 'b',
      position: 1,
      targetWeightKg: null,
      actualWeightKg: null,
    });
    expect(resolvePlateCalculatorTargetKg([done, empty], empty)).toBe(65);
    expect(resolvePlateCalculatorTargetKg([empty], null)).toBeNull();
  });
});

describe('réglages locaux des disques', () => {
  it('retourne les valeurs par défaut sans stockage valide', () => {
    localStorage.removeItem(PLATE_SETTINGS_STORAGE_KEY);
    expect(readPlateSettings()).toEqual(defaultPlateSettings());
    localStorage.setItem(PLATE_SETTINGS_STORAGE_KEY, '{"barKg":"x"}');
    expect(readPlateSettings()).toEqual(defaultPlateSettings());
    localStorage.setItem(PLATE_SETTINGS_STORAGE_KEY, 'not json');
    expect(readPlateSettings()).toEqual(defaultPlateSettings());
    localStorage.removeItem(PLATE_SETTINGS_STORAGE_KEY);
  });

  it('écrit puis relit des réglages normalisés', () => {
    writePlateSettings({ barKg: 15, platesKg: [5, 20, 5] });
    expect(readPlateSettings()).toEqual({ barKg: 15, platesKg: [20, 5] });
    localStorage.removeItem(PLATE_SETTINGS_STORAGE_KEY);
  });

  it('refuse une barre hors bornes', () => {
    expect(parsePlateSettings({ barKg: 80, platesKg: [] })).toBeNull();
    expect(parsePlateSettings({ barKg: -1, platesKg: [] })).toBeNull();
  });

  it('ajoute ou retire un disque', () => {
    const base = { barKg: 20, platesKg: [20, 10] };
    expect(togglePlate(base, 10)).toEqual({ barKg: 20, platesKg: [20] });
    expect(togglePlate(base, 2.5)).toEqual({ barKg: 20, platesKg: [20, 10, 2.5] });
    expect(normalizePlateList([1.25, 25, 1.25])).toEqual([25, 1.25]);
  });
});
