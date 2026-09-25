/** Distance avant de verrouiller l’axe (scroll vertical vs swipe). */
export const EXERCISE_SWIPE_AXIS_LOCK_PX = 12;

/** Déplacement horizontal minimal pour changer d’exercice. */
export const EXERCISE_SWIPE_MIN_DISTANCE_PX = 64;

/** |dx| doit dépasser |dy| de ce facteur pour être un swipe. */
export const EXERCISE_SWIPE_DOMINANCE = 1.5;

/** Flick court : distance plus faible si le geste est rapide et horizontal. */
export const EXERCISE_SWIPE_FLICK_DISTANCE_PX = 40;
export const EXERCISE_SWIPE_FLICK_MS = 250;

export type SwipeAxis = 'undecided' | 'horizontal' | 'vertical';

export type SwipeNavigation = 'previous' | 'next';

const INTERACTIVE_SELECTOR = [
  'input',
  'textarea',
  'select',
  'button',
  'a',
  'label',
  '[role="slider"]',
  '[role="tab"]',
  '[contenteditable="true"]',
].join(',');

export function isInteractiveSwipeTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  return target.closest(INTERACTIVE_SELECTOR) != null;
}

export function resolveSwipeAxis(dx: number, dy: number): SwipeAxis {
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (Math.max(absX, absY) < EXERCISE_SWIPE_AXIS_LOCK_PX) {
    return 'undecided';
  }
  if (absX > absY * EXERCISE_SWIPE_DOMINANCE) {
    return 'horizontal';
  }
  return 'vertical';
}

export function resolveSwipeNavigation(input: {
  dx: number;
  dy: number;
  elapsedMs: number;
  hasPrevious: boolean;
  hasNext: boolean;
}): SwipeNavigation | null {
  const axis = resolveSwipeAxis(input.dx, input.dy);
  if (axis !== 'horizontal') {
    return null;
  }
  const absX = Math.abs(input.dx);
  const flick =
    input.elapsedMs <= EXERCISE_SWIPE_FLICK_MS &&
    absX >= EXERCISE_SWIPE_FLICK_DISTANCE_PX;
  if (absX < EXERCISE_SWIPE_MIN_DISTANCE_PX && !flick) {
    return null;
  }
  if (input.dx < 0) {
    return input.hasNext ? 'next' : null;
  }
  if (input.dx > 0) {
    return input.hasPrevious ? 'previous' : null;
  }
  return null;
}
