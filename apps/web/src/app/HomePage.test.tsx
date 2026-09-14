import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HomePage } from './pages/HomePage';
import { createWorkoutSessionDetail } from '@/features/workouts/tests/fixtures';

const authState = {
  authStatus: 'unauthenticated' as
    | 'unauthenticated'
    | 'authenticated'
    | 'initializing',
};
const getActiveWorkoutSession = vi.fn();
const getActiveProgram = vi.fn();
const getMe = vi.fn();

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (state: { authStatus: string }) => unknown) =>
    selector(authState),
}));

vi.mock('@/features/profile/api/profile-api', () => ({
  getMe: (...args: unknown[]) => getMe(...args),
}));

vi.mock('@/features/programs/api/program-api', () => ({
  getActiveProgram: (...args: unknown[]) => getActiveProgram(...args),
  getProgram: vi.fn(),
  getProgramSchedule: vi.fn(),
  listPrograms: vi.fn(),
}));

vi.mock('@/features/workouts/api/workout-api', () => ({
  getActiveWorkoutSession: (...args: unknown[]) =>
    getActiveWorkoutSession(...args),
}));

vi.mock('@/features/workouts/offline/store', () => ({
  persistServerSnapshot: vi.fn(),
  getLocalActiveSnapshot: vi.fn(),
}));

function renderHome() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('HomePage', () => {
  beforeEach(() => {
    authState.authStatus = 'unauthenticated';
    getActiveWorkoutSession.mockReset();
    getActiveProgram.mockReset();
    getMe.mockReset();
  });

  it('renders the Gym Companion brand for guests', () => {
    renderHome();
    expect(
      screen.getByRole('heading', { name: 'Gym Companion' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Se connecter' }),
    ).toBeInTheDocument();
  });

  it('shows a resume card when a workout is ACTIVE', async () => {
    authState.authStatus = 'authenticated';
    getMe.mockResolvedValue({ data: { id: 'u1' } });
    getActiveProgram.mockResolvedValue(null);
    getActiveWorkoutSession.mockResolvedValue(
      createWorkoutSessionDetail({
        name: 'Push',
        status: 'ACTIVE',
        startedAt: '2026-09-14T16:04:00.000Z',
        timezone: 'Europe/Paris',
      }),
    );
    renderHome();
    expect(await screen.findByText('Séance en cours')).toBeInTheDocument();
    expect(screen.getByText('Push')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Reprendre la séance' }),
    ).toHaveAttribute('href', '/workouts/active');
    expect(screen.getByText(/0 \/ 1 séries/i)).toBeInTheDocument();
  });

  it('hides the resume card when there is no in-progress workout', async () => {
    authState.authStatus = 'authenticated';
    getMe.mockResolvedValue({ data: { id: 'u1' } });
    getActiveProgram.mockResolvedValue(null);
    getActiveWorkoutSession.mockResolvedValue(null);
    renderHome();
    expect(
      await screen.findByText('Aucun programme actif'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Séance en cours')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Reprendre la séance' }),
    ).not.toBeInTheDocument();
  });
});
