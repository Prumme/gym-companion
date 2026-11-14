import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_REST_END_SIGNAL_PREFERENCES,
  REST_END_SIGNAL_STORAGE_KEY,
  REST_END_VIBRATION_PATTERN_MS,
  isSoundSupported,
  isVibrationSupported,
  primeRestEndSound,
  readRestEndSignalPreferences,
  resetRestEndAudioContextForTests,
  triggerRestEndSignal,
  writeRestEndSignalPreferences,
  type AudioContextConstructor,
} from '../lib/rest-end-signal';
import { clearOtherRestTimers } from '../lib/rest-timer-storage';

function createAudioContextMock(initialState: AudioContextState = 'running') {
  const oscillator = {
    type: 'square',
    frequency: { setValueAtTime: vi.fn() },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  const gain = {
    gain: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  };
  const resume = vi.fn(() => Promise.resolve());
  const instances: unknown[] = [];
  class FakeAudioContext {
    currentTime = 0;
    destination = {};
    state = initialState;
    createOscillator = () => oscillator;
    createGain = () => gain;
    resume = resume;
    constructor() {
      instances.push(this);
    }
  }
  return {
    Ctor: FakeAudioContext as unknown as AudioContextConstructor,
    oscillator,
    gain,
    resume,
    instances,
  };
}

afterEach(() => {
  resetRestEndAudioContextForTests();
  localStorage.clear();
});

describe('préférences du signal de fin de repos', () => {
  it('retourne les valeurs par défaut sans stockage ou si le JSON est invalide', () => {
    expect(readRestEndSignalPreferences(null)).toEqual(DEFAULT_REST_END_SIGNAL_PREFERENCES);
    localStorage.setItem(REST_END_SIGNAL_STORAGE_KEY, '{oops');
    expect(readRestEndSignalPreferences()).toEqual(DEFAULT_REST_END_SIGNAL_PREFERENCES);
  });

  it('relit ce qui a été écrit et complète les champs manquants', () => {
    writeRestEndSignalPreferences({ vibration: false, sound: true });
    expect(readRestEndSignalPreferences()).toEqual({ vibration: false, sound: true });
    localStorage.setItem(REST_END_SIGNAL_STORAGE_KEY, JSON.stringify({ sound: true }));
    expect(readRestEndSignalPreferences()).toEqual({
      vibration: DEFAULT_REST_END_SIGNAL_PREFERENCES.vibration,
      sound: true,
    });
  });

  it('survit à un stockage qui lève (navigation privée)', () => {
    const throwing = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    expect(readRestEndSignalPreferences(throwing)).toEqual(DEFAULT_REST_END_SIGNAL_PREFERENCES);
    expect(() =>
      writeRestEndSignalPreferences({ vibration: true, sound: true }, throwing),
    ).not.toThrow();
  });

  it('n’est pas purgée avec les minuteries des autres séances', () => {
    writeRestEndSignalPreferences({ vibration: false, sound: true });
    clearOtherRestTimers('w1');
    expect(localStorage.getItem(REST_END_SIGNAL_STORAGE_KEY)).not.toBeNull();
  });
});

describe('triggerRestEndSignal', () => {
  it('vibre et bipe quand les deux signaux sont actifs', () => {
    const vibrate = vi.fn(() => true);
    const audio = createAudioContextMock();
    const outcome = triggerRestEndSignal(
      { vibration: true, sound: true },
      { navigator: { vibrate }, AudioContextCtor: audio.Ctor },
    );
    expect(outcome).toEqual({ vibrated: true, beeped: true });
    expect(vibrate).toHaveBeenCalledWith([...REST_END_VIBRATION_PATTERN_MS]);
    expect(audio.oscillator.start).toHaveBeenCalledTimes(1);
    expect(audio.oscillator.stop).toHaveBeenCalledTimes(1);
    expect(audio.oscillator.connect).toHaveBeenCalledWith(audio.gain);
  });

  it('respecte les préférences désactivées', () => {
    const vibrate = vi.fn(() => true);
    const audio = createAudioContextMock();
    const outcome = triggerRestEndSignal(
      { vibration: false, sound: false },
      { navigator: { vibrate }, AudioContextCtor: audio.Ctor },
    );
    expect(outcome).toEqual({ vibrated: false, beeped: false });
    expect(vibrate).not.toHaveBeenCalled();
    expect(audio.instances).toHaveLength(0);
  });

  it('ne plante pas si navigator.vibrate et AudioContext sont absents', () => {
    const env = { navigator: {}, AudioContextCtor: null };
    expect(triggerRestEndSignal({ vibration: true, sound: true }, env)).toEqual({
      vibrated: false,
      beeped: false,
    });
    expect(
      triggerRestEndSignal(
        { vibration: true, sound: true },
        {
          navigator: null,
          AudioContextCtor: null,
        },
      ),
    ).toEqual({ vibrated: false, beeped: false });
    expect(isVibrationSupported(env)).toBe(false);
    expect(isSoundSupported(env)).toBe(false);
  });

  it('ignore les erreurs levées par vibrate ou par le constructeur audio', () => {
    const vibrate = vi.fn(() => {
      throw new Error('blocked');
    });
    class Broken {
      constructor() {
        throw new Error('no audio');
      }
    }
    expect(
      triggerRestEndSignal(
        { vibration: true, sound: true },
        {
          navigator: { vibrate },
          AudioContextCtor: Broken as unknown as AudioContextConstructor,
        },
      ),
    ).toEqual({ vibrated: false, beeped: false });
  });

  it('réutilise un contexte audio débloqué et le relance s’il est suspendu', () => {
    const audio = createAudioContextMock('suspended');
    const env = { navigator: null, AudioContextCtor: audio.Ctor };
    expect(primeRestEndSound(env)).toBe(true);
    triggerRestEndSignal({ vibration: false, sound: true }, env);
    expect(audio.instances).toHaveLength(1);
    expect(audio.resume).toHaveBeenCalled();
  });
});
