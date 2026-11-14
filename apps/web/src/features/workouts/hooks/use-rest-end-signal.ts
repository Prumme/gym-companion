import { useCallback, useEffect, useRef, useState } from 'react';

import {
  isSoundSupported,
  isVibrationSupported,
  primeRestEndSound,
  readRestEndSignalPreferences,
  triggerRestEndSignal,
  writeRestEndSignalPreferences,
  type RestEndSignalPreferences,
} from '../lib/rest-end-signal';

/** Préférences locales (appareil) du signal de fin de repos et déclencheur associé. */
export function useRestEndSignal() {
  const [preferences, setPreferences] = useState<RestEndSignalPreferences>(() =>
    readRestEndSignalPreferences(),
  );
  const preferencesRef = useRef(preferences);

  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  const setPreference = useCallback((key: keyof RestEndSignalPreferences, value: boolean) => {
    if (key === 'sound' && value) {
      // Geste utilisateur : débloque WebAudio (iOS / Safari).
      primeRestEndSound();
    }
    setPreferences((current) => {
      const next = { ...current, [key]: value };
      writeRestEndSignalPreferences(next);
      return next;
    });
  }, []);

  const signal = useCallback(() => {
    triggerRestEndSignal(preferencesRef.current);
  }, []);

  return {
    preferences,
    setPreference,
    signal,
    vibrationSupported: isVibrationSupported(),
    soundSupported: isSoundSupported(),
  };
}
