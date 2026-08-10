import {
  CalendarDays,
  ClipboardList,
  Dumbbell,
  History,
  Home,
  Trophy,
  UserRound,
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';

import { PwaUpdateBanner } from '@/lib/pwa/PwaUpdateBanner';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';

const navItems = [
  { to: '/', label: 'Accueil', icon: Home, end: true },
  { to: '/planning', label: 'Planning', icon: CalendarDays, end: false },
  { to: '/workouts', label: 'Historique', icon: History, end: true },
  { to: '/records', label: 'Records', icon: Trophy, end: true },
  { to: '/programs', label: 'Programmes', icon: ClipboardList, end: false },
  { to: '/exercises', label: 'Exercices', icon: Dumbbell, end: false },
  { to: '/profile', label: 'Profil', icon: UserRound, end: false },
] as const;

export function AppLayout() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 pt-6 pb-24 md:pb-8">
      <header className="mb-6">
        <p className="text-sm font-semibold tracking-[0.18em] text-[var(--muted)] uppercase">
          Gym Companion
        </p>
      </header>
      <PwaUpdateBanner />
      <Outlet />

      {isAuthenticated ? (
        <nav
          aria-label="Navigation principale"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[var(--card)]/95 backdrop-blur md:static md:mt-8 md:rounded-[var(--radius)] md:border md:backdrop-blur-none"
        >
          <ul className="mx-auto flex max-w-3xl items-stretch justify-around px-2 py-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to} className="flex-1">
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'flex min-h-12 flex-col items-center justify-center gap-1 rounded-[var(--radius)] px-2 text-xs font-medium',
                        isActive
                          ? 'text-[var(--primary)]'
                          : 'text-[var(--muted)] hover:text-[var(--foreground)]',
                      )
                    }
                  >
                    <Icon className="size-5" aria-hidden="true" />
                    {item.label}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
