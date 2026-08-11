import { create } from 'zustand';

/**
 * Store UI global (hors auth).
 * L’état d’initialisation auth vit dans `auth-store` (`authStatus`).
 */
type UiStore = Record<string, never>;

export const useUiStore = create<UiStore>(() => ({}));
