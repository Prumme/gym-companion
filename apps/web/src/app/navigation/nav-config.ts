import type { LucideIcon } from 'lucide-react';
import {
  CalendarDays,
  ChartColumn,
  ClipboardList,
  Dumbbell,
  History,
  Home,
  Sparkles,
  Trophy,
  UserRound,
  Users,
} from 'lucide-react';

/**
 * Configuration centralisée de la navigation globale.
 * Mobile (bottom + Plus) et desktop (sidebar) consomment les mêmes données.
 */

export type AppNavItem = {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
  /** NavLink `end` — match exact du path. */
  end?: boolean;
  /**
   * Préfixes additionnels pour l’état actif
   * (ex. hub Entraînement actif sur /planning).
   */
  matchPrefixes?: readonly string[];
  /** Sous-titre affiché dans le menu Plus. */
  description?: string;
};

export type MoreNavGroup = {
  id: string;
  label: string;
  items: readonly AppNavItem[];
};

/** 3 destinations métier de la bottom nav (sans « Plus »). */
export const primaryNavItems: readonly AppNavItem[] = [
  {
    id: 'home',
    label: 'Accueil',
    to: '/',
    icon: Home,
    end: true,
  },
  {
    id: 'training',
    label: 'Entraînement',
    to: '/training',
    icon: Dumbbell,
    end: false,
    matchPrefixes: ['/training', '/planning', '/programs', '/workouts'],
  },
  {
    id: 'progress',
    label: 'Progression',
    to: '/progress',
    icon: ChartColumn,
    end: false,
    matchPrefixes: ['/progress', '/records'],
  },
] as const;

/** Groupes du menu Plus (mobile sheet + sidebar). Pas de Paramètres (inexistant). */
export const moreNavGroups: readonly MoreNavGroup[] = [
  {
    id: 'training-more',
    label: 'Entraînement',
    items: [
      {
        id: 'exercises',
        label: 'Exercices',
        description: 'Catalogue et favoris',
        to: '/exercises',
        icon: Dumbbell,
        end: false,
      },
      {
        id: 'shared',
        label: 'Séances partagées',
        description: 'Salles partagées',
        to: '/shared-workouts',
        icon: Users,
        end: false,
      },
    ],
  },
  {
    id: 'coaching-more',
    label: 'Coaching',
    items: [
      {
        id: 'coach',
        label: 'Coach',
        description: 'Conseils et analyses',
        to: '/coach',
        icon: Sparkles,
        end: false,
      },
    ],
  },
  {
    id: 'account-more',
    label: 'Compte',
    items: [
      {
        id: 'profile',
        label: 'Profil',
        description: 'Identité et préférences',
        to: '/profile',
        icon: UserRound,
        end: false,
      },
    ],
  },
] as const;

/** Destinations du menu Plus (liste plate dérivée des groupes). */
export const moreNavItems: readonly AppNavItem[] = moreNavGroups.flatMap(
  (group) => group.items,
);

/** Liens du hub Entraînement. */
export const trainingHubLinks: readonly AppNavItem[] = [
  {
    id: 'planning',
    label: 'Planning',
    to: '/planning',
    icon: CalendarDays,
  },
  {
    id: 'programs',
    label: 'Programmes',
    to: '/programs',
    icon: ClipboardList,
  },
  {
    id: 'history',
    label: 'Historique',
    to: '/workouts',
    icon: History,
    end: true,
  },
] as const;

/** Liens du hub Progression. */
export const progressHubLinks: readonly AppNavItem[] = [
  {
    id: 'progress-overview',
    label: 'Vue d’ensemble',
    to: '/progress',
    icon: ChartColumn,
  },
  {
    id: 'records',
    label: 'Records',
    to: '/records',
    icon: Trophy,
    end: true,
  },
] as const;

/** Routes en mode focus (masque bottom nav + sidebar). */
export const FOCUS_MODE_PATH_PREFIXES = ['/workouts/active'] as const;

export function isFocusModePath(pathname: string): boolean {
  return FOCUS_MODE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isNavItemActive(
  item: AppNavItem,
  pathname: string,
): boolean {
  if (item.end) {
    if (pathname === item.to) return true;
  } else if (pathname === item.to || pathname.startsWith(`${item.to}/`)) {
    return true;
  }

  if (item.matchPrefixes) {
    return item.matchPrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
  }

  return false;
}

/** Destinations interdites dans la bottom nav (régression). */
export const FORBIDDEN_BOTTOM_NAV_PATHS = [
  '/planning',
  '/workouts',
  '/shared-workouts',
  '/records',
  '/coach',
  '/programs',
  '/exercises',
  '/profile',
] as const;
