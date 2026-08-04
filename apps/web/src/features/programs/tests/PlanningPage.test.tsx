import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PlanningPage } from '../pages/PlanningPage';
import { createActiveProgramSummary } from './fixtures';

const getActiveProgram = vi.fn();
const deactivateProgram = vi.fn();
const getActiveWorkoutSession = vi.fn();
const getMe = vi.fn();

vi.mock('../api/program-api', async () => {
  const actual = await vi.importActual<typeof import('../api/program-api')>(
    '../api/program-api',
  );
  return {
    ...actual,
    getActiveProgram: (...args: unknown[]) => getActiveProgram(...args),
    deactivateProgram: (...args: unknown[]) => deactivateProgram(...args),
  };
});

vi.mock('@/features/workouts/api/workout-api', () => ({
  getActiveWorkoutSession: (...args: unknown[]) =>
    getActiveWorkoutSession(...args),
  createWorkoutSession: vi.fn(),
  getWorkoutSessionDetail: vi.fn(),
}));

vi.mock('@/features/profile/api/profile-api', () => ({
  getMe: (...args: unknown[]) => getMe(...args),
}));

function renderPlanning(active = null as ReturnType<typeof createActiveProgramSummary> | null) {
  getActiveProgram.mockResolvedValue(active);
  getActiveWorkoutSession.mockResolvedValue(null);
  getMe.mockResolvedValue({
    data: { profile: { timezone: 'Europe/Paris' } },
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/planning']}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return render(<PlanningPage />, { wrapper });
}

describe('PlanningPage', () => {
  beforeEach(() => {
    getActiveProgram.mockReset();
    deactivateProgram.mockReset();
    getActiveWorkoutSession.mockReset();
    getMe.mockReset();
  });

  it('shows empty state when no active program', async () => {
    renderPlanning(null);
    expect(await screen.findByText('Aucun programme courant.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Voir mes programmes/i })).toHaveAttribute(
      'href',
      '/programs',
    );
    expect(screen.getByRole('link', { name: /Créer un programme/i })).toHaveAttribute(
      'href',
      '/programs/new',
    );
  });

  it('shows active program summary and weekly schedule', async () => {
    renderPlanning(createActiveProgramSummary());
    expect(await screen.findByText('Push Pull Legs')).toBeInTheDocument();
    expect(screen.getByText(/1 séance planifiée par semaine/i)).toBeInTheDocument();
    expect(screen.getByText('Lundi')).toBeInTheDocument();
    expect(screen.getByText('Push A')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Démarrer cette séance/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Modifier le planning/i }),
    ).toHaveAttribute('href', '/programs/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/schedule');
  });

  it('deactivates the active program', async () => {
    const user = userEvent.setup();
    deactivateProgram.mockResolvedValue(null);
    renderPlanning(createActiveProgramSummary());

    await screen.findByText('Push Pull Legs');
    const openButtons = screen.getAllByRole('button', { name: /^Désactiver$/i });
    await user.click(openButtons[0]!);
    const confirmDialog = screen.getByRole('alertdialog');
    await user.click(
      within(confirmDialog).getByRole('button', { name: /^Désactiver$/i }),
    );

    await waitFor(() =>
      expect(deactivateProgram).toHaveBeenCalledWith(
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      ),
    );
    expect(await screen.findByText(/Programme courant désactivé/i)).toBeInTheDocument();
  });
});
