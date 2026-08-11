import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SharedWorkoutsPage } from '../pages/SharedWorkoutsPage';

const listSharedWorkoutRooms = vi.fn();
const joinSharedWorkoutRoom = vi.fn();

vi.mock('../api/shared-workouts-api', () => ({
  listSharedWorkoutRooms: (...args: unknown[]) =>
    listSharedWorkoutRooms(...args),
  joinSharedWorkoutRoom: (...args: unknown[]) =>
    joinSharedWorkoutRoom(...args),
}));

function renderPage(initialEntry = '/shared-workouts') {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/shared-workouts" element={<SharedWorkoutsPage />} />
          <Route
            path="/shared-workouts/:roomId"
            element={<div data-testid="room-detail" />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SharedWorkoutsPage', () => {
  beforeEach(() => {
    listSharedWorkoutRooms.mockReset();
    joinSharedWorkoutRoom.mockReset();
    listSharedWorkoutRooms.mockResolvedValue({
      data: [],
      pagination: { nextCursor: null, hasMore: false },
    });
  });

  it('affiche l’état vide', async () => {
    renderPage();
    expect(
      await screen.findByRole('heading', { name: /aucune séance partagée/i }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: /créer une salle/i }),
    ).toHaveLength(1);
    expect(
      screen.getByRole('button', { name: /saisir un code/i }),
    ).toBeInTheDocument();
  });

  it('liste les salles compactes avec labels textuels', async () => {
    listSharedWorkoutRooms.mockResolvedValue({
      data: [
        {
          id: 'r1',
          name: 'Lobby A',
          status: 'LOBBY',
          memberCount: 1,
          owner: { userId: 'u1', displayName: 'Alice' },
          updatedAt: '2026-08-10T12:00:00.000Z',
          createdAt: '2026-08-10T12:00:00.000Z',
        },
        {
          id: 'r2',
          name: 'Active B',
          status: 'ACTIVE',
          memberCount: 2,
          owner: { userId: 'u1', displayName: 'Alice' },
          updatedAt: '2026-08-10T11:00:00.000Z',
          createdAt: '2026-08-10T11:00:00.000Z',
        },
        {
          id: 'r3',
          name: 'Done C',
          status: 'COMPLETED',
          memberCount: 1,
          owner: { userId: 'u2', displayName: 'Bob' },
          updatedAt: '2026-08-10T10:00:00.000Z',
          createdAt: '2026-08-10T10:00:00.000Z',
        },
        {
          id: 'r4',
          name: 'Cancel D',
          status: 'CANCELLED',
          memberCount: 1,
          owner: { userId: 'u1', displayName: 'Alice' },
          updatedAt: '2026-08-10T09:00:00.000Z',
          createdAt: '2026-08-10T09:00:00.000Z',
        },
      ],
      pagination: { nextCursor: null, hasMore: false },
    });
    renderPage();

    expect(await screen.findByText('Lobby A')).toBeInTheDocument();
    expect(screen.getAllByText(/en préparation/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/en cours/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/terminée/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/annulée/i).length).toBeGreaterThan(0);
    expect(
      screen.getByRole('link', { name: /lobby a/i }),
    ).toHaveAttribute('href', '/shared-workouts/r1');
    expect(
      screen.getByRole('button', { name: /rejoindre avec un code/i }),
    ).toBeInTheDocument();
  });

  it('ouvre la feuille de saisie du code', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole('heading', { name: /aucune séance partagée/i });
    await user.click(
      screen.getByRole('button', { name: /rejoindre avec un code/i }),
    );

    expect(
      screen.getByRole('dialog', { name: /rejoindre une salle/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/entre le code partagé par l’hôte/i),
    ).toBeInTheDocument();
  });

  it('formate le code pendant la saisie', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      screen.getByRole('button', { name: /rejoindre avec un code/i }),
    );
    const input = screen.getByLabelText(/code d’accès/i);
    await user.type(input, 'k7m4p');

    expect(input).toHaveValue('K7M-4P');
  });

  it('accepte le collage d’un code formaté', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      screen.getByRole('button', { name: /rejoindre avec un code/i }),
    );
    const input = screen.getByLabelText(/code d’accès/i);
    await user.click(input);
    await user.paste('K7M-4PX');

    expect(input).toHaveValue('K7M-4PX');
  });

  it('désactive Rejoindre tant que le code est incomplet', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      screen.getByRole('button', { name: /rejoindre avec un code/i }),
    );
    const submit = screen.getByRole('button', { name: /^rejoindre$/i });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText(/code d’accès/i), 'K7M4PX');
    expect(submit).toBeEnabled();
  });

  it('rejoint une salle et navigue vers le détail', async () => {
    const user = userEvent.setup();
    joinSharedWorkoutRoom.mockResolvedValue({
      id: 'room-joined',
      name: 'Salle rejointe',
      status: 'LOBBY',
    });

    renderPage();
    await user.click(
      screen.getByRole('button', { name: /rejoindre avec un code/i }),
    );
    await user.type(screen.getByLabelText(/code d’accès/i), 'K7M4PX');
    await user.click(screen.getByRole('button', { name: /^rejoindre$/i }));

    await waitFor(() => {
      expect(joinSharedWorkoutRoom).toHaveBeenCalledWith({ code: 'K7M4PX' });
    });
    expect(await screen.findByTestId('room-detail')).toBeInTheDocument();
  });

  it('affiche une erreur pour un code invalide', async () => {
    const user = userEvent.setup();
    joinSharedWorkoutRoom.mockRejectedValue(
      Object.assign(new Error('Code invalide ou expiré.'), {
        code: 'SHARED_WORKOUT_JOIN_CODE_INVALID',
        status: 404,
      }),
    );

    renderPage();
    await user.click(
      screen.getByRole('button', { name: /rejoindre avec un code/i }),
    );
    await user.type(screen.getByLabelText(/code d’accès/i), 'AAAAAA');
    await user.click(screen.getByRole('button', { name: /^rejoindre$/i }));

    expect(
      await screen.findByText(/code invalide ou expiré/i),
    ).toBeInTheDocument();
  });

  it('affiche une erreur en cas de rate limit', async () => {
    const user = userEvent.setup();
    joinSharedWorkoutRoom.mockRejectedValue(
      Object.assign(new Error('Too many requests'), { status: 429 }),
    );

    renderPage();
    await user.click(
      screen.getByRole('button', { name: /rejoindre avec un code/i }),
    );
    await user.type(screen.getByLabelText(/code d’accès/i), 'K7M4PX');
    await user.click(screen.getByRole('button', { name: /^rejoindre$/i }));

    expect(
      await screen.findByText(/trop de tentatives/i),
    ).toBeInTheDocument();
  });

  it('affiche une erreur réseau', async () => {
    const user = userEvent.setup();
    joinSharedWorkoutRoom.mockRejectedValue(new TypeError('Failed to fetch'));

    renderPage();
    await user.click(
      screen.getByRole('button', { name: /rejoindre avec un code/i }),
    );
    await user.type(screen.getByLabelText(/code d’accès/i), 'K7M4PX');
    await user.click(screen.getByRole('button', { name: /^rejoindre$/i }));

    expect(
      await screen.findByText(
        /impossible de rejoindre la salle pour le moment/i,
      ),
    ).toBeInTheDocument();
  });
});
