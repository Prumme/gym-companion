import { useCallback, useState } from 'react';

import {
  defaultPlateSettings,
  readPlateSettings,
  togglePlate as togglePlateInSettings,
  writePlateSettings,
  type PlateSettings,
} from '../lib/plate-settings-storage';

/** Réglages barre / disques persistés sur l’appareil (localStorage). */
export function usePlateSettings() {
  const [settings, setSettings] = useState<PlateSettings>(() => readPlateSettings());

  const update = useCallback((updater: (current: PlateSettings) => PlateSettings) => {
    setSettings((current) => {
      const next = updater(current);
      writePlateSettings(next);
      return next;
    });
  }, []);

  const setBarKg = useCallback(
    (barKg: number) => update((current) => ({ ...current, barKg })),
    [update],
  );
  const togglePlate = useCallback(
    (plateKg: number) => update((current) => togglePlateInSettings(current, plateKg)),
    [update],
  );
  const reset = useCallback(() => update(() => defaultPlateSettings()), [update]);

  return { settings, setBarKg, togglePlate, reset };
}
