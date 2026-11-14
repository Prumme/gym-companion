/** Durée d’affichage de chaque image de la démonstration animée. */
export const EXERCISE_MEDIA_FRAME_INTERVAL_MS = 900;

export function getNextExerciseMediaFrameIndex(current: number, frameCount: number): number {
  if (frameCount <= 1) {
    return 0;
  }
  return (current + 1) % frameCount;
}

export function getExerciseMediaFrameLabel(index: number, frameCount: number): string {
  if (index === 0) {
    return 'Départ';
  }
  if (index === frameCount - 1) {
    return 'Fin';
  }
  return `Étape ${index + 1}`;
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
