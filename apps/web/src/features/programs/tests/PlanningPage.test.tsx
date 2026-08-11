import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PlanningPage } from '../pages/PlanningPage';
import {
  createActiveProgramSummary,
  createProgramDetail,
  createTemplate,
} from './fixtures';

const getActiveProgram = vi.fn();
const deactivateProgram = vi.fn();
const getActiveWorkoutSession = vi.fn();
const getMe = vi.fn();
const getProgram = vi.fn();
const replaceProgramSchedule = vi.fn();

vi.mock('../api/program-api', async () => {
  const actual = await vi.importActual<typeof import('../api/program-api')>(
    '../api/program-api',
  );
  return {
    ...actual,
    getActiveProgram: (...args: unknown[]) => getActiveProgram(...args),
    deactivateProgram: (...args: unknown[]) => deactivateProgram(...args),
    getProgram: (...args: unknown[]) => getProgram(...args),
    replaceProgramSchedule: (...args: unknown[]) =>
      replaceProgramSchedule(...args),
  };
});

vi.mock('../lib/weekdays', async () => {
  const actual = await vi.importActual<typeof import('../lib/weekdays')>(
    '../lib/weekdays',
  );
  return {
    ...actual,
    getTodayWeekday: () => 'MONDAY' as const,
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

function renderPlanning(
  active = null as ReturnType<typeof createActiveProgramSummary> | null,
) {
  getActiveProgram.mockResolvedValue(active);
  getActiveWorkoutSession.mockResolvedValue(null);
  getMe.mockResolvedValue({
    data: { profile: { timezone: 'Europe/Paris' } },
  });
  getProgram.mockResolvedValue(
    createProgramDetail({
      workoutTemplates: [
        createTemplate({ id: 'wt-1', name: 'Push A' }),
        createTemplate({ id: 'wt-2', name: 'Pull A', position: 1 }),
      ],
    }),
  );
  replaceProgramSchedule.mockResolvedValue({ entries: [] });
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
    getProgram.mockReset();
    replaceProgramSchedule.mockReset();
  });

  it('shows empty state when no active program', async () => {
    renderPlanning(null);
    expect(
      await screen.findByText('Aucun programme actif'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Voir mes programmes/i }),
    ).toHaveAttribute('href', '/programs');
    expect(
      screen.getByRole('link', { name: /Créer un programme/i }),
    ).toHaveAttribute('href', '/programs/new');
  });

  it('shows empty schedule CTA when active program has no entries', async () => {
    renderPlanning(
      createActiveProgramSummary({
        schedule: { entries: [] },
      }),
    );
    expect(
      await screen.findByText('Planning non configuré'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Configurer ma semaine/i }),
    ).toHaveAttribute(
      'href',
      '/programs/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/schedule',
    );
  });

  it('shows active program context, today block and compact week', async () => {
    renderPlanning(createActiveProgramSummary());
    expect(await screen.findByText('Push Pull Legs')).toBeInTheDocument();
    expect(screen.getByText(/1 séance \/ semaine/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Aujourd’hui/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Semaine type')).toBeInTheDocument();
    expect(screen.getAllByText('Push A').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Repos').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /^Démarrer$/i })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Modifier le planning/i }),
    ).toHaveAttribute(
      'href',
      '/programs/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/schedule',
    );
    expect(screen.getByRole('link', { name: /Voir →/i })).toHaveAttribute(
      'href',
      '/programs/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    );
  });

  it('opens day sheet and saves schedule replace', async () => {
    const user = userEvent.setup();
    renderPlanning(createActiveProgramSummary());
    await screen.findByText('Push Pull Legs');

    await user.click(screen.getByRole('button', { name: /Mar : Repos/i }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Mardi')).toBeInTheDocument();

    await user.selectOptions(
      await screen.findByLabelText(/Séance prévue/i),
      'wt-2',
    );
    await user.click(screen.getByRole('button', { name: /Enregistrer/i }));

    await waitFor(() =>
      expect(replaceProgramSchedule).toHaveBeenCalledWith(
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        {
          entries: expect.arrayContaining([
            expect.objectContaining({
              workoutTemplateId: 'wt-1',
              weekday: 'MONDAY',
            }),
            expect.objectContaining({
              workoutTemplateId: 'wt-2',
              weekday: 'TUESDAY',
            }),
          ]),
        },
      ),
    );
  });

  it('deactivates the active program', async () => {
    const user = userEvent.setup();
    deactivateProgram.mockResolvedValue(null);
    renderPlanning(createActiveProgramSummary());

    await screen.findByText('Push Pull Legs');
    const openButtons = screen.getAllByRole('button', {
      name: /Désactiver le programme/i,
    });
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
    expect(
      await screen.findByText(/Programme courant désactivé/i),
    ).toBeInTheDocument();
  });
});
