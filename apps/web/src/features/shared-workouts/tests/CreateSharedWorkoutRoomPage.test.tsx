import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { CreateSharedWorkoutRoomPage } from '../pages/CreateSharedWorkoutRoomPage';

const createSharedWorkoutRoom = vi.fn();

vi.mock('../api/shared-workouts-api', () => ({
  createSharedWorkoutRoom: (...args: unknown[]) =>
    createSharedWorkoutRoom(...args),
}));

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/shared-workouts/new']}>
        <Routes>
          <Route
            path="/shared-workouts/new"
            element={<CreateSharedWorkoutRoomPage />}
          />
          <Route
            path="/shared-workouts/:roomId"
            element={<p>Lobby room</p>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CreateSharedWorkoutRoomPage', () => {
  it('crée une salle et redirige vers le détail', async () => {
    const user = userEvent.setup();
    createSharedWorkoutRoom.mockResolvedValue({
      id: 'room-1',
      name: 'Ma salle',
      status: 'LOBBY',
    });

    renderPage();

    expect(
      screen.getByRole('heading', { name: /créer une salle/i }),
    ).toBeInTheDocument();

    await user.type(
      screen.getByLabelText(/nom de la salle/i),
      'Ma salle',
    );
    await user.click(screen.getByRole('button', { name: /créer la salle/i }));

    await waitFor(() => {
      expect(createSharedWorkoutRoom).toHaveBeenCalled();
      expect(createSharedWorkoutRoom.mock.calls[0]?.[0]).toEqual({
        name: 'Ma salle',
      });
    });
    expect(await screen.findByText('Lobby room')).toBeInTheDocument();
  });

  it('affiche une erreur API', async () => {
    const user = userEvent.setup();
    createSharedWorkoutRoom.mockRejectedValue(new Error('Erreur réseau'));

    renderPage();
    await user.click(screen.getByRole('button', { name: /créer la salle/i }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
