import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SharedWorkoutInvitationsPage } from '../pages/SharedWorkoutInvitationsPage';

const listReceivedInvitations = vi.fn();
const acceptSharedWorkoutInvitation = vi.fn();
const declineSharedWorkoutInvitation = vi.fn();

vi.mock('../api/shared-workouts-api', () => ({
  listReceivedInvitations: (...args: unknown[]) =>
    listReceivedInvitations(...args),
  acceptSharedWorkoutInvitation: (...args: unknown[]) =>
    acceptSharedWorkoutInvitation(...args),
  declineSharedWorkoutInvitation: (...args: unknown[]) =>
    declineSharedWorkoutInvitation(...args),
}));

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/shared-workouts/invitations']}>
        <Routes>
          <Route
            path="/shared-workouts/invitations"
            element={<SharedWorkoutInvitationsPage />}
          />
          <Route path="/shared-workouts/:roomId" element={<p>Room</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SharedWorkoutInvitationsPage', () => {
  beforeEach(() => {
    listReceivedInvitations.mockReset();
    acceptSharedWorkoutInvitation.mockReset();
    declineSharedWorkoutInvitation.mockReset();
  });

  it('affiche l’état vide', async () => {
    listReceivedInvitations.mockResolvedValue({
      data: [],
      pagination: { nextCursor: null, hasMore: false },
    });
    renderPage();
    expect(
      await screen.findByRole('heading', {
        name: /aucune invitation en attente/i,
      }),
    ).toBeInTheDocument();
  });

  it('accepte une invitation et propose d’ouvrir la salle', async () => {
    const user = userEvent.setup();
    listReceivedInvitations.mockResolvedValue({
      data: [
        {
          id: 'inv-1',
          room: { id: 'room-1', name: 'Séance du soir', status: 'LOBBY' },
          inviter: { displayName: 'Aurélien' },
          invitee: { displayName: 'Bob' },
          status: 'PENDING',
          createdAt: '2026-08-10T10:00:00.000Z',
          respondedAt: null,
          cancelledAt: null,
        },
      ],
      pagination: { nextCursor: null, hasMore: false },
    });
    acceptSharedWorkoutInvitation.mockResolvedValue({
      id: 'inv-1',
      room: { id: 'room-1', name: 'Séance du soir', status: 'LOBBY' },
      inviter: { displayName: 'Aurélien' },
      invitee: { displayName: 'Bob' },
      status: 'ACCEPTED',
      createdAt: '2026-08-10T10:00:00.000Z',
      respondedAt: '2026-08-10T10:05:00.000Z',
      cancelledAt: null,
    });

    renderPage();
    expect(await screen.findByText(/séance du soir/i)).toBeInTheDocument();
    expect(screen.getByText(/invité par aurélien/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /accepter/i }));
    await waitFor(() => {
      expect(acceptSharedWorkoutInvitation).toHaveBeenCalled();
    });
    expect(
      await screen.findByRole('link', { name: /ouvrir la salle/i }),
    ).toHaveAttribute('href', '/shared-workouts/room-1');
  });
});
