import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActiveWorkoutPage } from '../pages/ActiveWorkoutPage';
import { StartWorkoutButton } from '../components/StartWorkoutButton';
import { createWorkoutSessionDetail } from './fixtures';

const getActiveWorkoutSession = vi.fn();
const createWorkoutSession = vi.fn();
const getMe = vi.fn();

vi.mock('../api/workout-api', () => ({
  getActiveWorkoutSession: (...args: unknown[]) =>
    getActiveWorkoutSession(...args),
  createWorkoutSession: (...args: unknown[]) => createWorkoutSession(...args),
  getWorkoutSessionDetail: vi.fn(),
}));

vi.mock('@/features/profile/api/profile-api', () => ({
  getMe: (...args: unknown[]) => getMe(...args),
}));

function renderApp(ui: ReactNode, initialEntry: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/start" element={ui} />
          <Route path="/workouts/active" element={<ActiveWorkoutPage />} />
          <Route path="/planning" element={<div>Planning page</div>} />
          <Route path="/programs" element={<div>Programs page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ActiveWorkoutPage', () => {
  beforeEach(() => {
    getActiveWorkoutSession.mockReset();
    createWorkoutSession.mockReset();
    getMe.mockReset();
    getMe.mockResolvedValue({
      data: {
        profile: { timezone: 'Europe/Paris' },
      },
    });
  });

  it('affiche l’état vide sans séance active', async () => {
    getActiveWorkoutSession.mockResolvedValue(null);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/workouts/active']}>
          <Routes>
            <Route path="/workouts/active" element={<ActiveWorkoutPage />} />
            <Route path="/planning" element={<div>Planning page</div>} />
            <Route path="/programs" element={<div>Programs page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Aucune séance en cours.')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Consulter le planning/i }),
    ).toHaveAttribute('href', '/planning');
    expect(
      screen.getByRole('link', { name: /Consulter les programmes/i }),
    ).toHaveAttribute('href', '/programs');
    expect(
      screen.queryByRole('button', { name: /Pause|Terminer|Annuler/i }),
    ).not.toBeInTheDocument();
  });

  it('affiche le snapshot en lecture seule', async () => {
    getActiveWorkoutSession.mockResolvedValue(createWorkoutSessionDetail());
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/workouts/active']}>
          <ActiveWorkoutPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Séance Push')).toBeInTheDocument();
    expect(screen.getByText(/Push Pull Legs/)).toBeInTheDocument();
    expect(screen.getByText(/Développé couché/)).toBeInTheDocument();
    expect(
      screen.getByText(
        /Travail — 8 à 10 répétitions — 60 kg — RIR 2 — repos 120 s/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Lecture seule/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/répétitions/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Pause/i }),
    ).not.toBeInTheDocument();
  });
});

describe('StartWorkoutButton', () => {
  beforeEach(() => {
    getActiveWorkoutSession.mockReset();
    createWorkoutSession.mockReset();
    getMe.mockReset();
    getMe.mockResolvedValue({
      data: {
        profile: { timezone: 'Europe/Paris' },
      },
    });
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    });
  });

  it('demande confirmation puis crée et navigue', async () => {
    const user = userEvent.setup();
    getActiveWorkoutSession.mockResolvedValue(null);
    const created = createWorkoutSessionDetail();
    createWorkoutSession.mockImplementation(async () => {
      getActiveWorkoutSession.mockResolvedValue(created);
      return created;
    });

    renderApp(
      <StartWorkoutButton
        sourceWorkoutTemplateId="cccccccc-cccc-cccc-cccc-cccccccccccc"
        label="Démarrer cette séance"
      />,
      '/start',
    );

    await user.click(
      screen.getByRole('button', { name: /Démarrer cette séance/i }),
    );
    const dialog = await screen.findByRole('alertdialog');
    await user.click(
      within(dialog).getByRole('button', { name: /^Démarrer$/i }),
    );

    await waitFor(() =>
      expect(createWorkoutSession).toHaveBeenCalledTimes(1),
    );
    expect(createWorkoutSession).toHaveBeenCalledWith({
      sourceWorkoutTemplateId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      localDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      timezone: 'Europe/Paris',
    });
    expect(await screen.findByText('Séance Push')).toBeInTheDocument();
  });

  it('propose d’ouvrir la séance existante en cas de conflit', async () => {
    const user = userEvent.setup();
    getActiveWorkoutSession.mockResolvedValue(createWorkoutSessionDetail());

    renderApp(
      <StartWorkoutButton sourceWorkoutTemplateId="cccccccc-cccc-cccc-cccc-cccccccccccc" />,
      '/start',
    );

    await user.click(screen.getByRole('button', { name: /^Démarrer$/i }));
    expect(
      await screen.findByText(/Séance déjà en cours/i),
    ).toBeInTheDocument();
    expect(createWorkoutSession).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole('button', { name: /Ouvrir la séance en cours/i }),
    );
    expect(await screen.findByText('Séance Push')).toBeInTheDocument();
  });

  it('affiche une erreur réseau compréhensible', async () => {
    const user = userEvent.setup();
    getActiveWorkoutSession.mockResolvedValue(null);
    createWorkoutSession.mockRejectedValue(new Error('Failed to fetch'));

    renderApp(
      <StartWorkoutButton sourceWorkoutTemplateId="cccccccc-cccc-cccc-cccc-cccccccccccc" />,
      '/start',
    );

    await user.click(screen.getByRole('button', { name: /^Démarrer$/i }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(
      within(dialog).getByRole('button', { name: /^Démarrer$/i }),
    );

    expect(
      await screen.findByText(
        /Une connexion est nécessaire pour démarrer une séance/i,
      ),
    ).toBeInTheDocument();
  });
});
