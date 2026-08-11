import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppLayout } from '@/app/layouts/AppLayout';
import {
  FORBIDDEN_BOTTOM_NAV_PATHS,
  primaryNavItems,
} from '@/app/navigation/nav-config';
import { TrainingHubPage } from '@/app/pages/TrainingHubPage';

const authState = {
  isAuthenticated: true,
  authStatus: 'authenticated' as const,
};

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (state: typeof authState) => unknown) =>
    selector(authState),
}));

vi.mock('@/lib/pwa/PwaUpdateBanner', () => ({
  PwaUpdateBanner: () => null,
}));

function renderShell(initialPath = '/') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<p>Accueil content</p>} />
            <Route path="training" element={<TrainingHubPage />} />
            <Route path="progress" element={<p>Progression content</p>} />
            <Route path="exercises" element={<p>Exercices</p>} />
            <Route path="workouts/active" element={<p>Séance active</p>} />
            <Route path="planning" element={<p>Planning</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('App shell navigation', () => {
  beforeEach(() => {
    authState.isAuthenticated = true;
    authState.authStatus = 'authenticated';
    // jsdom: matchMedia for md breakpoint — treat as mobile by default
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('bottom nav affiche exactement Accueil, Entraînement, Progression, Plus', () => {
    renderShell('/');
    const nav = screen.getByRole('navigation', {
      name: 'Navigation principale',
    });
    const links = nav.querySelectorAll('a');
    expect(links).toHaveLength(primaryNavItems.length);
    expect(
      within(nav).getByRole('link', { name: /Accueil/i }),
    ).toBeInTheDocument();
    expect(
      within(nav).getByRole('link', { name: /Entraînement/i }),
    ).toBeInTheDocument();
    expect(
      within(nav).getByRole('link', { name: /Progression/i }),
    ).toBeInTheDocument();
    expect(
      within(nav).getByRole('button', { name: /Plus/i }),
    ).toBeInTheDocument();
  });

  it('n’expose pas les destinations secondaires dans la bottom nav', () => {
    renderShell('/');
    const nav = screen.getByRole('navigation', {
      name: 'Navigation principale',
    });
    for (const path of FORBIDDEN_BOTTOM_NAV_PATHS) {
      expect(nav.querySelector(`a[href="${path}"]`)).toBeNull();
    }
  });

  it('ouvre et ferme le menu Plus puis navigue', async () => {
    const user = userEvent.setup();
    renderShell('/');
    const nav = screen.getByRole('navigation', {
      name: 'Navigation principale',
    });
    await user.click(within(nav).getByRole('button', { name: /Plus/i }));
    const sheet = screen.getByRole('dialog', { name: 'Plus' });
    expect(sheet).toBeInTheDocument();
    const exercisesLink = within(sheet).getByRole('link', {
      name: /Exercices/i,
    });
    expect(within(sheet).getByText('Entraînement')).toBeInTheDocument();
    expect(within(sheet).getByText('Coaching')).toBeInTheDocument();
    expect(within(sheet).getByText('Compte')).toBeInTheDocument();
    await user.click(exercisesLink);
    expect(screen.queryByRole('dialog', { name: 'Plus' })).not.toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Navigation principale' })
        .querySelector('a[href="/exercises"]'),
    ).toBeNull();
    // Contenu de la route /exercises
    expect(
      screen.getByText('Exercices', { selector: 'p' }),
    ).toBeInTheDocument();
  });

  it('marque Entraînement actif sur le hub', () => {
    renderShell('/training');
    const nav = screen.getByRole('navigation', {
      name: 'Navigation principale',
    });
    const link = within(nav).getByRole('link', { name: /Entraînement/i });
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('masque la bottom nav en séance active (focus mode)', () => {
    renderShell('/workouts/active');
    expect(
      screen.queryByRole('navigation', { name: 'Navigation principale' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Séance active')).toBeInTheDocument();
  });

  it('affiche la sidebar desktop avec les groupes de navigation', () => {
    renderShell('/');
    const aside = screen.getByRole('complementary', {
      name: 'Navigation latérale',
    });
    expect(aside.textContent).toMatch(/Gym Companion/);
    expect(aside.textContent).toMatch(/Accueil/);
    expect(aside.textContent).toMatch(/Entraînement/);
    expect(aside.textContent).toMatch(/Progression/);
    expect(aside.textContent).toMatch(/Exercices/);
    expect(aside.textContent).toMatch(/Séances partagées/);
    expect(aside.textContent).toMatch(/Coach/);
    expect(aside.textContent).toMatch(/Profil/);
  });
});
