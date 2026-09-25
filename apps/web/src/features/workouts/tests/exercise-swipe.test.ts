import { describe, expect, it } from 'vitest';

import {
  isInteractiveSwipeTarget,
  resolveSwipeAxis,
  resolveSwipeNavigation,
} from '../lib/exercise-swipe';

const base = { hasPrevious: true, hasNext: true, elapsedMs: 400 };

describe('resolveSwipeNavigation', () => {
  it('swipe gauche assez long → exercice suivant', () => {
    expect(
      resolveSwipeNavigation({ ...base, dx: -100, dy: 10 }),
    ).toBe('next');
  });

  it('swipe droite assez long → exercice précédent', () => {
    expect(
      resolveSwipeNavigation({ ...base, dx: 100, dy: 8 }),
    ).toBe('previous');
  });

  it('mouvement sous le seuil → aucune navigation', () => {
    expect(
      resolveSwipeNavigation({ ...base, dx: 30, dy: 4 }),
    ).toBeNull();
  });

  it('mouvement vertical → aucune navigation', () => {
    expect(resolveSwipeAxis(20, 100)).toBe('vertical');
    expect(
      resolveSwipeNavigation({ ...base, dx: 20, dy: 100 }),
    ).toBeNull();
  });

  it('premier exercice + swipe droite → reste en place', () => {
    expect(
      resolveSwipeNavigation({
        dx: 120,
        dy: 8,
        elapsedMs: 300,
        hasPrevious: false,
        hasNext: true,
      }),
    ).toBeNull();
  });

  it('dernier exercice + swipe gauche → reste en place', () => {
    expect(
      resolveSwipeNavigation({
        dx: -120,
        dy: 8,
        elapsedMs: 300,
        hasPrevious: true,
        hasNext: false,
      }),
    ).toBeNull();
  });

  it('flick horizontal rapide mais marqué → navigation', () => {
    expect(
      resolveSwipeNavigation({ ...base, dx: -42, dy: 6, elapsedMs: 140 }),
    ).toBe('next');
  });
});

describe('isInteractiveSwipeTarget', () => {
  it('ignore un input', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    expect(isInteractiveSwipeTarget(input)).toBe(true);
    input.remove();
  });
});
