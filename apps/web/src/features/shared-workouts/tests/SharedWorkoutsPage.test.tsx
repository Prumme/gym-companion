import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SharedWorkoutsPage } from '../pages/SharedWorkoutsPage';

const listSharedWorkoutRooms = vi.fn();
const listReceivedInvitations = vi.fn();

vi.mock('../api/shared-workouts-api', () => ({
  listSharedWorkoutRooms: (...args: unknown[]) =>
    listSharedWorkoutRooms(...args),
  listReceivedInvitations: (...args: unknown[]) =>
    listReceivedInvitations(...args),
  acceptSharedWorkoutInvitation: vi.fn(),
  declineSharedWorkoutInvitation: vi.fn(),
}));

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SharedWorkoutsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SharedWorkoutsPage', () => {
  beforeEach(() => {
    listSharedWorkoutRooms.mockReset();
    listReceivedInvitations.mockReset();
    listReceivedInvitations.mockResolvedValue({
      data: [],
      pagination: { nextCursor: null, hasMore: false },
    });
  });

  it('affiche l’état vide', async () => {
    listSharedWorkoutRooms.mockResolvedValue({
      data: [],
      pagination: { nextCursor: null, hasMore: false },
    });
    renderPage();
    expect(
      await screen.findByRole('heading', { name: /aucune séance partagée/i }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: /créer une salle/i }),
    ).toHaveLength(1);
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
  });

  it('affiche les invitations prioritaires', async () => {
    listSharedWorkoutRooms.mockResolvedValue({
      data: [],
      pagination: { nextCursor: null, hasMore: false },
    });
    listReceivedInvitations.mockResolvedValue({
      data: [
        {
          id: 'inv-1',
          room: { id: 'r9', name: 'Pull du mardi', status: 'LOBBY' },
          inviter: { displayName: 'Aurélien' },
          invitee: { displayName: 'Moi' },
          status: 'PENDING',
          createdAt: '2026-08-10T12:00:00.000Z',
          respondedAt: null,
          cancelledAt: null,
        },
      ],
      pagination: { nextCursor: null, hasMore: false },
    });
    renderPage();

    expect(await screen.findByText(/invitations/i)).toBeInTheDocument();
    expect(screen.getByText('Pull du mardi')).toBeInTheDocument();
    expect(screen.getByText(/aurélien t’invite/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /rejoindre/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /refuser/i }),
    ).toBeInTheDocument();
  });
});
