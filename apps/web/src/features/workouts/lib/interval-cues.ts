/**
 * Signaux de changement de phase du fractionné : vibration et bip court.
 * Silencieux si l’API n’est pas disponible (navigateur, autorisations).
 */

let audioContext: AudioContext | null = null;

/** À appeler sur un geste utilisateur (ex. « Démarrer ») pour autoriser le son. */
export function unlockIntervalAudio(): void {
  if (typeof window === 'undefined') return;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  try {
    audioContext ??= new Ctor();
    void audioContext.resume();
  } catch {
    audioContext = null;
  }
}

function beep(frequency: number, durationMs: number): void {
  if (!audioContext) return;
  try {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.value = 0.15;
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + durationMs / 1000);
  } catch {
    // son indisponible : la vibration et l’affichage suffisent
  }
}

/** Signal fort au début d’un effort, plus doux pour une récupération. */
export function playIntervalPhaseCue(kind: 'WORK' | 'REST' | 'END'): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(kind === 'WORK' ? [250, 100, 250] : kind === 'END' ? [500] : [150]);
  }
  if (kind === 'WORK') beep(880, 250);
  else if (kind === 'END') beep(660, 600);
  else beep(440, 200);
}
