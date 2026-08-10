import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SharedWorkoutRoomDetail } from '@gym-companion/shared';

import { SharedWorkoutRoomDetailPage } from '../pages/SharedWorkoutRoomDetailPage';

const getSharedWorkoutRoom = vi.fn();

vi.mock('../hooks/use-shared-workout-room-realtime', () => ({
  useSharedWorkoutRoomRealtime: () => ({
    connectedUserIds: new Set(['user-a']),
    connectionStatus: 'connected',
    realtimeAvailable: true,
  }),
}));

vi.mock('../api/shared-workouts-api', () => ({
  getSharedWorkoutRoom: (...args: unknown[]) => getSharedWorkoutRoom(...args),
  getMySharedWorkoutSession: vi.fn(async () => ({
    linked: false,
    workoutSession: null,
    activeWorkoutElsewhere: null,
  })),
  listRoomInvitations: vi.fn(async () => ({
    data: [],
    pagination: { nextCursor: null, hasMore: false },
  })),
  updateSharedWorkoutRoom: vi.fn(),
  startSharedWorkoutRoom: vi.fn(),
  completeSharedWorkoutRoom: vi.fn(),
  cancelSharedWorkoutRoom: vi.fn(),
  inviteToSharedWorkoutRoom: vi.fn(),
  cancelRoomInvitation: vi.fn(),
  leaveSharedWorkoutRoom: vi.fn(),
  attachMySharedWorkoutSession: vi.fn(),
  createMySharedWorkoutSession: vi.fn(),
}));

vi.mock('@/features/programs/api/program-api', () => ({
  getActiveProgram: vi.fn(async () => null),
  getProgram: vi.fn(),
  listPrograms: vi.fn(),
  getProgramSchedule: vi.fn(),
}));

function roomFixture(
  overrides: Partial<SharedWorkoutRoomDetail> = {},
): SharedWorkoutRoomDetail {
  return {
    id: 'room-1',
    name: 'Séance duo',
    status: 'LOBBY',
    owner: { userId: 'user-a', displayName: 'Alice' },
    members: [
      {
        userId: 'user-a',
        role: 'OWNER',
        displayName: 'Alice',
        joinedAt: '2026-08-10T10:00:00.000Z',
        memberWorkout: {
          status: 'NOT_STARTED',
          workoutName: null,
          startedAt: null,
          completedAt: null,
        },
      },
    ],
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    createdAt: '2026-08-10T10:00:00.000Z',
    updatedAt: '2026-08-10T10:00:00.000Z',
    isOwner: true,
    myWorkoutSessionId: null,
    ...overrides,
  };
}

function renderDetail(roomId = 'room-1') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/shared-workouts/${roomId}`]}>
        <Routes>
          <Route
            path="/shared-workouts/:roomId"
            element={<SharedWorkoutRoomDetailPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SharedWorkoutRoomDetailPage', () => {
  beforeEach(() => {
    getSharedWorkoutRoom.mockReset();
  });

  it('affiche le lobby owner avec start', async () => {
    getSharedWorkoutRoom.mockResolvedValue(roomFixture());
    renderDetail();

    expect(
      await screen.findByRole('heading', { name: /séance duo/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/en préparation/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /démarrer la séance partagée/i }),
    ).toBeInTheDocument();
  });

  it('affiche ACTIVE avec terminer / annuler', async () => {
    getSharedWorkoutRoom.mockResolvedValue(
      roomFixture({
        status: 'ACTIVE',
        startedAt: '2026-08-10T11:00:00.000Z',
      }),
    );
    renderDetail();

    expect(await screen.findByText(/séance partagée en cours/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /terminer/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^annuler$/i }),
    ).toBeInTheDocument();
  });

  it('vue terminale sans actions lifecycle', async () => {
    getSharedWorkoutRoom.mockResolvedValue(
      roomFixture({
        status: 'COMPLETED',
        startedAt: '2026-08-10T11:00:00.000Z',
        completedAt: '2026-08-10T12:00:00.000Z',
        isOwner: true,
      }),
    );
    renderDetail();

    expect(
      await screen.findByText(/séance partagée terminée/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /démarrer/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /terminer/i }),
    ).not.toBeInTheDocument();
  });

  it('membre non-owner : lecture seule + leave', async () => {
    getSharedWorkoutRoom.mockResolvedValue(
      roomFixture({
        isOwner: false,
        members: [
          {
            userId: 'user-a',
            role: 'OWNER',
            displayName: 'Alice',
            joinedAt: '2026-08-10T10:00:00.000Z',
            memberWorkout: {
              status: 'NOT_STARTED',
              workoutName: null,
              startedAt: null,
              completedAt: null,
            },
          },
          {
            userId: 'user-b',
            role: 'MEMBER',
            displayName: 'Bob',
            joinedAt: '2026-08-10T10:05:00.000Z',
            memberWorkout: {
              status: 'NOT_STARTED',
              workoutName: null,
              startedAt: null,
              completedAt: null,
            },
          },
        ],
      }),
    );
    renderDetail();

    expect(await screen.findByText(/bob/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /démarrer/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /renommer/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /quitter la salle/i }),
    ).toBeInTheDocument();
  });

  it('affiche Ma séance en LOBBY sans attach', async () => {
    getSharedWorkoutRoom.mockResolvedValue(roomFixture());
    renderDetail();

    expect(
      await screen.findByRole('heading', { name: /ma séance/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/pourront être démarrées lorsque la salle sera lancée/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /rattacher ma séance/i }),
    ).not.toBeInTheDocument();
  });

  it('cartes membres : présence et séance indépendantes', async () => {
    getSharedWorkoutRoom.mockResolvedValue(
      roomFixture({
        status: 'ACTIVE',
        startedAt: '2026-08-10T11:00:00.000Z',
        members: [
          {
            userId: 'user-a',
            role: 'OWNER',
            displayName: 'Alice',
            joinedAt: '2026-08-10T10:00:00.000Z',
            memberWorkout: {
              status: 'ACTIVE',
              workoutName: 'Push',
              startedAt: '2026-08-10T11:05:00.000Z',
              completedAt: null,
            },
          },
          {
            userId: 'user-b',
            role: 'MEMBER',
            displayName: 'Bob',
            joinedAt: '2026-08-10T10:05:00.000Z',
            memberWorkout: {
              status: 'NOT_STARTED',
              workoutName: null,
              startedAt: null,
              completedAt: null,
            },
          },
        ],
      }),
    );
    renderDetail();

    expect(await screen.findByText(/séance : push — en cours/i)).toBeInTheDocument();
    expect(screen.getByText(/séance : pas démarrée/i)).toBeInTheDocument();
  });
});
