import { z } from 'zod';

import { DEFAULT_BAR_WEIGHT_KG, DEFAULT_PLATES_KG, kgToGrams } from './plate-calculator';

/**
 * Réglages locaux (appareil) du calculateur de disques. V1 : pas de préférence de profil
 * ni de migration ; voir docs/01 §6.3 pour l’évolution prévue.
 */
export type PlateSettings = {
  barKg: number;
  platesKg: number[];
};

export const PLATE_SETTINGS_STORAGE_KEY = 'gym-companion:plate-calculator';

/** Disques proposés dans le réglage (kg), du plus lourd au plus léger. */
export const PLATE_CATALOG_KG: readonly number[] = [25, 20, 15, 10, 5, 2.5, 2, 1.25, 1, 0.5];

export const MIN_BAR_WEIGHT_KG = 0;
export const MAX_BAR_WEIGHT_KG = 50;

const plateSettingsSchema = z.object({
  barKg: z.number().finite().min(MIN_BAR_WEIGHT_KG).max(MAX_BAR_WEIGHT_KG),
  platesKg: z.array(z.number().finite().positive().max(50)).max(PLATE_CATALOG_KG.length * 2),
});

export function defaultPlateSettings(): PlateSettings {
  return { barKg: DEFAULT_BAR_WEIGHT_KG, platesKg: [...DEFAULT_PLATES_KG] };
}

/** Trie (décroissant) et dédoublonne au gramme près. */
export function normalizePlateList(platesKg: readonly number[]): number[] {
  const seen = new Set<number>();
  const result: number[] = [];
  for (const kg of [...platesKg].sort((a, b) => b - a)) {
    const grams = kgToGrams(kg);
    if (grams > 0 && !seen.has(grams)) {
      seen.add(grams);
      result.push(kg);
    }
  }
  return result;
}

export function parsePlateSettings(value: unknown): PlateSettings | null {
  const parsed = plateSettingsSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }
  return { barKg: parsed.data.barKg, platesKg: normalizePlateList(parsed.data.platesKg) };
}

export function readPlateSettings(
  storage: Pick<Storage, 'getItem'> | null = safeLocalStorage(),
): PlateSettings {
  try {
    const raw = storage?.getItem(PLATE_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return defaultPlateSettings();
    }
    return parsePlateSettings(JSON.parse(raw)) ?? defaultPlateSettings();
  } catch {
    return defaultPlateSettings();
  }
}

export function writePlateSettings(
  settings: PlateSettings,
  storage: Pick<Storage, 'setItem'> | null = safeLocalStorage(),
): void {
  try {
    storage?.setItem(PLATE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore (quota / navigation privée)
  }
}

export function togglePlate(settings: PlateSettings, plateKg: number): PlateSettings {
  const grams = kgToGrams(plateKg);
  const present = settings.platesKg.some((kg) => kgToGrams(kg) === grams);
  return {
    ...settings,
    platesKg: present
      ? settings.platesKg.filter((kg) => kgToGrams(kg) !== grams)
      : normalizePlateList([...settings.platesKg, plateKg]),
  };
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
