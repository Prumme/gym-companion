import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Rend un overlay dans `document.body`.
 * Un ancêtre avec `transform` ou `will-change: transform` (swipe d’exercice)
 * redéfinit le containing block de `position: fixed`. Le portail évite que
 * les feuilles de séance soient contraintes à la carte animée.
 */
export function ViewportPortal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') {
    return null;
  }
  return createPortal(children, document.body);
}
