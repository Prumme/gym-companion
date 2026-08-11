import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProfilePage } from './ProfilePage';

const getMe = vi.fn();
const updateProfile = vi.fn();

vi.mock('@/features/profile/api/profile-api', () => ({
  getMe: (...args: unknown[]) => getMe(...args),
  updateProfile: (...args: unknown[]) => updateProfile(...args),
}));

vi.mock('@/features/auth/api/auth-api', () => ({
  logout: vi.fn(),
}));

const meResponse = {
  data: {
    id: 'user-1',
    email: 'user@example.com',
    status: 'ACTIVE',
    role: 'USER',
    profile: {
      displayName: 'Aurélien',
      timezone: 'Europe/Paris',
      weightUnit: 'KG' as const,
      distanceUnit: 'KM' as const,
      primaryGoal: 'GENERAL_FITNESS' as const,
      experienceLevel: 'BEGINNER' as const,
      effortTrackingMode: 'NONE' as const,
      heightCm: null,
      currentWeightKg: null,
      weeklyTrainingTarget: null,
      defaultWorkoutDurationMinutes: null,
    },
    ai: {
      available: false,
    },
  },
};

function renderProfile() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );

  return render(<ProfilePage />, { wrapper });
}

describe('ProfilePage', () => {
  beforeEach(() => {
    getMe.mockReset();
    updateProfile.mockReset();
    getMe.mockResolvedValue(meResponse);
  });

  it('submits successfully and shows a confirmation', async () => {
    const user = userEvent.setup();
    updateProfile.mockResolvedValue({
      data: {
        ...meResponse.data,
        profile: {
          ...meResponse.data.profile,
          displayName: 'Nouveau nom',
          primaryGoal: 'STRENGTH',
        },
      },
    });

    renderProfile();

    expect(await screen.findByText('Aurélien')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Modifier' }));

    expect(await screen.findByDisplayValue('Aurélien')).toBeInTheDocument();

    const nameInput = screen.getByLabelText('Nom affiché');
    await user.clear(nameInput);
    await user.type(nameInput, 'Nouveau nom');
    await user.selectOptions(screen.getByLabelText('Objectif principal'), 'STRENGTH');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(updateProfile.mock.calls[0]?.[0]).toMatchObject({
        displayName: 'Nouveau nom',
        primaryGoal: 'STRENGTH',
      });
    });

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Profil enregistré avec succès.',
    );
    expect(screen.getByText('Nouveau nom')).toBeInTheDocument();
  });

  it('shows an API error and keeps the typed values', async () => {
    const user = userEvent.setup();
    updateProfile.mockRejectedValue(new Error('Service temporairement indisponible.'));

    renderProfile();
    expect(await screen.findByText('Aurélien')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Modifier' }));

    const nameInput = screen.getByLabelText('Nom affiché');
    await user.clear(nameInput);
    await user.type(nameInput, 'Valeur conservée');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Service temporairement indisponible.',
    );
    expect(screen.getByDisplayValue('Valeur conservée')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows field validation errors without calling the API', async () => {
    const user = userEvent.setup();
    renderProfile();
    expect(await screen.findByText('Aurélien')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Modifier' }));

    const nameInput = screen.getByLabelText('Nom affiché');
    await user.clear(nameInput);
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('Le nom affiché est requis.')).toBeInTheDocument();
    expect(updateProfile).not.toHaveBeenCalled();
  });
});
