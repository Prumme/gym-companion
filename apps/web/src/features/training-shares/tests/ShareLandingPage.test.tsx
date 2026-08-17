import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ShareLandingPage } from '../pages/ShareLandingPage';

const getSharePreview = vi.fn();
const importShare = vi.fn();
const listPrograms = vi.fn();

vi.mock('../api/training-share-api', () => ({
  getSharePreview: (...args: unknown[]) => getSharePreview(...args),
  importShare: (...args: unknown[]) => importShare(...args),
  buildShareUrl: (token: string) => `http://localhost/share/${token}`,
}));

vi.mock('@/features/programs/api/program-api', () => ({
  listPrograms: (...args: unknown[]) => listPrograms(...args),
}));

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: (
    selector: (state: { authStatus: string }) => unknown,
  ) =>
    selector({
      authStatus: 'authenticated',
    }),
}));

function renderPage(token = 'tok-abc') {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/share/${token}`]}>
        <Routes>
          <Route path="/share/:token" element={<ShareLandingPage />} />
          <Route
            path="/programs/:programId"
            element={<div data-testid="program-detail" />}
          />
          <Route path="/login" element={<div data-testid="login" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ShareLandingPage', () => {
  beforeEach(() => {
    getSharePreview.mockReset();
    importShare.mockReset();
    listPrograms.mockReset();
    listPrograms.mockResolvedValue({
      data: [
        {
          id: 'prog-1',
          name: 'Mon programme',
          archivedAt: null,
          permissions: { canEdit: true },
        },
      ],
      pagination: { nextCursor: null, hasMore: false },
    });
  });

  it('affiche la preview programme et importe', async () => {
    const user = userEvent.setup();
    getSharePreview.mockResolvedValue({
      kind: 'PROGRAM',
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      preview: {
        kind: 'PROGRAM',
        name: 'Débutant — Full Body',
        description: null,
        goal: 'HYPERTROPHY',
        workoutCount: 1,
        workouts: [
          {
            name: 'Full Body A',
            estimatedDurationMinutes: 45,
            exerciseCount: 1,
            exercises: [
              {
                exerciseId: 'ex-1',
                name: 'Presse à cuisses',
                measurementType: 'WEIGHT_REPS',
                sets: [
                  {
                    setType: 'WORKING',
                    targetRepMin: 8,
                    targetRepMax: 12,
                    targetDurationSeconds: null,
                    targetDistanceMeters: null,
                    targetWeightKg: null,
                    restSeconds: 90,
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    importShare.mockResolvedValue({
      kind: 'PROGRAM',
      programId: 'imported-1',
      workoutTemplateId: null,
    });

    renderPage();

    expect(
      await screen.findByRole('heading', { name: /débutant — full body/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/programme partagé/i)).toBeInTheDocument();
    expect(screen.queryByText(/partagé par/i)).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: /ajouter à mes programmes/i }),
    );

    await waitFor(() => {
      expect(importShare).toHaveBeenCalledWith('tok-abc', {});
    });
    expect(await screen.findByText(/programme ajouté/i)).toBeInTheDocument();
  });

  it('affiche l’état expiré', async () => {
    getSharePreview.mockRejectedValue(
      Object.assign(new Error('expired'), {
        code: 'SHARE_LINK_EXPIRED',
        status: 410,
      }),
    );
    renderPage();
    expect(
      await screen.findByRole('heading', { name: /lien expiré/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/valides pendant 1 heure/i),
    ).toBeInTheDocument();
  });

  it('affiche l’état invalide', async () => {
    getSharePreview.mockRejectedValue(
      Object.assign(new Error('invalid'), {
        code: 'SHARE_LINK_INVALID',
        status: 404,
      }),
    );
    renderPage();
    expect(
      await screen.findByRole('heading', { name: /lien invalide/i }),
    ).toBeInTheDocument();
  });

  it('importe une séance dans un nouveau programme', async () => {
    const user = userEvent.setup();
    getSharePreview.mockResolvedValue({
      kind: 'WORKOUT_TEMPLATE',
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      preview: {
        kind: 'WORKOUT_TEMPLATE',
        name: 'Full Body A',
        description: null,
        estimatedDurationMinutes: 45,
        exerciseCount: 1,
        exercises: [
          {
            exerciseId: 'ex-1',
            name: 'Chest Press machine',
            measurementType: 'WEIGHT_REPS',
            sets: [
              {
                setType: 'WORKING',
                targetRepMin: 8,
                targetRepMax: 12,
                targetDurationSeconds: null,
                targetDistanceMeters: null,
                targetWeightKg: null,
                restSeconds: 90,
              },
            ],
          },
        ],
      },
    });
    importShare.mockResolvedValue({
      kind: 'WORKOUT_TEMPLATE',
      programId: 'new-prog',
      workoutTemplateId: 'wt-1',
    });

    renderPage();
    await user.click(
      await screen.findByRole('button', { name: /ajouter cette séance/i }),
    );
    expect(
      await screen.findByRole('heading', {
        name: /où veux-tu ajouter cette séance/i,
      }),
    ).toBeInTheDocument();

    const nameInput = screen.getByLabelText(/nom du programme/i);
    expect(nameInput).toHaveValue('Programme Full Body A');

    await user.click(
      screen.getByRole('button', { name: /créer et ajouter la séance/i }),
    );

    await waitFor(() => {
      expect(importShare).toHaveBeenCalledWith('tok-abc', {
        destination: {
          type: 'NEW_PROGRAM',
          programName: 'Programme Full Body A',
        },
      });
    });
    expect(await screen.findByText(/séance ajoutée/i)).toBeInTheDocument();
  });
});
