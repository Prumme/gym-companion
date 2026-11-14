/**
 * Signal local de fin de repos (vibration + bip WebAudio). Aucun fichier audio,
 * aucune dépendance, aucun Web Push (phase 7).
 */

export type RestEndSignalPreferences = {
  vibration: boolean;
  sound: boolean;
};

/** Clé volontairement hors du préfixe `gym-companion:rest-timer:` (purgé par `clearOtherRestTimers`). */
export const REST_END_SIGNAL_STORAGE_KEY = 'gym-companion:rest-end-signal';

/** Vibration active par défaut ; son facultatif (docs/07 §16.4) donc désactivé par défaut. */
export const DEFAULT_REST_END_SIGNAL_PREFERENCES: RestEndSignalPreferences = {
  vibration: true,
  sound: false,
};

export const REST_END_VIBRATION_PATTERN_MS: readonly number[] = [200, 100, 200];
export const REST_END_BEEP_FREQUENCY_HZ = 880;
export const REST_END_BEEP_DURATION_SECONDS = 0.18;

export function readRestEndSignalPreferences(
  storage: Pick<Storage, 'getItem'> | null = safeLocalStorage(),
): RestEndSignalPreferences {
  try {
    const raw = storage?.getItem(REST_END_SIGNAL_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_REST_END_SIGNAL_PREFERENCES };
    }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { ...DEFAULT_REST_END_SIGNAL_PREFERENCES };
    }
    const record = parsed as Record<string, unknown>;
    return {
      vibration:
        typeof record.vibration === 'boolean'
          ? record.vibration
          : DEFAULT_REST_END_SIGNAL_PREFERENCES.vibration,
      sound:
        typeof record.sound === 'boolean'
          ? record.sound
          : DEFAULT_REST_END_SIGNAL_PREFERENCES.sound,
    };
  } catch {
    return { ...DEFAULT_REST_END_SIGNAL_PREFERENCES };
  }
}

export function writeRestEndSignalPreferences(
  preferences: RestEndSignalPreferences,
  storage: Pick<Storage, 'setItem'> | null = safeLocalStorage(),
): void {
  try {
    storage?.setItem(REST_END_SIGNAL_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Quota / navigation privée — la préférence reste en mémoire.
  }
}

type VibrateCapable = { vibrate?: (pattern: number | number[]) => boolean };

type MinimalAudioContext = Pick<
  AudioContext,
  'currentTime' | 'destination' | 'state' | 'createOscillator' | 'createGain' | 'resume'
>;

export type AudioContextConstructor = new () => MinimalAudioContext;

export type RestEndSignalEnvironment = {
  navigator: VibrateCapable | null;
  AudioContextCtor: AudioContextConstructor | null;
};

export function getBrowserSignalEnvironment(): RestEndSignalEnvironment {
  if (typeof window === 'undefined') {
    return { navigator: null, AudioContextCtor: null };
  }
  const audioWindow = window as Window & {
    webkitAudioContext?: AudioContextConstructor;
  };
  return {
    navigator: typeof navigator === 'undefined' ? null : (navigator as VibrateCapable),
    AudioContextCtor:
      (window.AudioContext as AudioContextConstructor | undefined) ??
      audioWindow.webkitAudioContext ??
      null,
  };
}

let sharedAudioContext: MinimalAudioContext | null = null;
let sharedAudioContextCtor: AudioContextConstructor | null = null;

function getAudioContext(ctor: AudioContextConstructor): MinimalAudioContext | null {
  if (sharedAudioContext && sharedAudioContextCtor === ctor) {
    return sharedAudioContext;
  }
  try {
    sharedAudioContext = new ctor();
    sharedAudioContextCtor = ctor;
    return sharedAudioContext;
  } catch {
    return null;
  }
}

/** Réservé aux tests : oublie le contexte audio partagé. */
export function resetRestEndAudioContextForTests(): void {
  sharedAudioContext = null;
  sharedAudioContextCtor = null;
}

/**
 * À appeler depuis un geste utilisateur (activation du son) : iOS/Safari n’autorisent
 * la lecture WebAudio qu’après un déblocage par interaction.
 */
export function primeRestEndSound(
  env: RestEndSignalEnvironment = getBrowserSignalEnvironment(),
): boolean {
  if (!env.AudioContextCtor) {
    return false;
  }
  const context = getAudioContext(env.AudioContextCtor);
  if (!context) {
    return false;
  }
  if (context.state === 'suspended') {
    void context.resume().catch(() => undefined);
  }
  return true;
}

export function playRestEndBeep(ctor: AudioContextConstructor): boolean {
  const context = getAudioContext(ctor);
  if (!context) {
    return false;
  }
  try {
    if (context.state === 'suspended') {
      void context.resume().catch(() => undefined);
    }
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime;
    const end = start + REST_END_BEEP_DURATION_SECONDS;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(REST_END_BEEP_FREQUENCY_HZ, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(end);
    return true;
  } catch {
    return false;
  }
}

export type RestEndSignalOutcome = { vibrated: boolean; beeped: boolean };

/** Déclenche les signaux activés ; chaque API absente ou en erreur est ignorée silencieusement. */
export function triggerRestEndSignal(
  preferences: RestEndSignalPreferences,
  env: RestEndSignalEnvironment = getBrowserSignalEnvironment(),
): RestEndSignalOutcome {
  let vibrated = false;
  let beeped = false;

  if (preferences.vibration && typeof env.navigator?.vibrate === 'function') {
    try {
      vibrated = env.navigator.vibrate([...REST_END_VIBRATION_PATTERN_MS]);
    } catch {
      vibrated = false;
    }
  }

  if (preferences.sound && env.AudioContextCtor) {
    beeped = playRestEndBeep(env.AudioContextCtor);
  }

  return { vibrated, beeped };
}

export function isVibrationSupported(
  env: RestEndSignalEnvironment = getBrowserSignalEnvironment(),
): boolean {
  return typeof env.navigator?.vibrate === 'function';
}

export function isSoundSupported(
  env: RestEndSignalEnvironment = getBrowserSignalEnvironment(),
): boolean {
  return env.AudioContextCtor != null;
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
