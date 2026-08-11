import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SharedWorkoutRoomDetail } from '@gym-companion/shared';

import { SharedWorkoutRoomDetailPage } from '../pages/SharedWorkoutRoomDetailPage';

const getSharedWorkoutRoom = vi.fn();

const realtimeState = {
  connectedUserIds: new Set(['user-a']),
  connectionStatus: 'connected' as 'connected' | 'connecting' | 'error' | 'disconnected',
  realtimeAvailable: true,
};

vi.mock('../hooks/use-shared-workout-room-realtime', () => ({
  useSharedWorkoutRoomRealtime: () => ({
    connectedUserIds: realtimeState.connectedUserIds,
    connectionStatus: realtimeState.connectionStatus,
    realtimeAvailable: realtimeState.realtimeAvailable,
  }),
}));

vi.mock('../api/shared-workouts-api', () => ({
  getSharedWorkoutRoom: (...args: unknown[]) => getSharedWorkoutRoom(...args),
  getMySharedWorkoutSession: vi.fn(async () => ({
    linked: false,
    workoutSession: null,
    activeWorkoutElsewhere: null,
  })),
  getSharedWorkoutEquipmentCoordination: vi.fn(async () => ({
    roomId: 'room-1',
    equipment: [],
  })),
  getMySharedEquipment: vi.fn(async () => ({
    state: 'NONE',
    equipment: null,
    queuePosition: null,
    occupiedBy: null,
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
  requestMySharedEquipment: vi.fn(),
  releaseMySharedEquipment: vi.fn(),
  cancelMySharedEquipmentWaiting: vi.fn(),
}));

vi.mock('@/features/programs/api/program-api', () => ({
  getActiveProgram: vi.fn(async () => null),
  getProgram: vi.fn(),
  listPrograms: vi.fn(),
  getProgramSchedule: vi.fn(),
}));

vi.mock('@/features/profile/api/profile-api', () => ({
  getMe: vi.fn(async () => ({
    data: {
      id: 'user-a',
      email: 'a@example.com',
      status: 'ACTIVE',
      role: 'USER',
      profile: {
        displayName: 'Alice',
        timezone: 'Europe/Paris',
        weightUnit: 'KG',
        distanceUnit: 'KM',
        primaryGoal: 'HYPERTROPHY',
        experienceLevel: 'INTERMEDIATE',
        effortTrackingMode: 'RIR',
        heightCm: null,
        currentWeightKg: null,
        weeklyTrainingTarget: null,
        defaultWorkoutDurationMinutes: null,
      },
      ai: { available: false },
    },
  })),
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
          currentExercise: null,
          progress: null,
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
    realtimeState.connectedUserIds = new Set(['user-a']);
    realtimeState.connectionStatus = 'connected';
    realtimeState.realtimeAvailable = true;
  });

  it('affiche le lobby owner avec start', async () => {
    getSharedWorkoutRoom.mockResolvedValue(roomFixture());
    renderDetail();

    expect(
      await screen.findByRole('heading', { name: /séance duo/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/en préparation/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /démarrer la séance/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/temps réel connecté/i)).not.toBeInTheDocument();
  });

  it('affiche ACTIVE avec terminer / annuler dans le menu', async () => {
    const user = userEvent.setup();
    getSharedWorkoutRoom.mockResolvedValue(
      roomFixture({
        status: 'ACTIVE',
        startedAt: '2026-08-10T11:00:00.000Z',
      }),
    );
    renderDetail();

    expect(await screen.findByText(/en cours/i)).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: /actions de la salle/i }),
    );
    expect(
      screen.getByRole('menuitem', { name: /terminer/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: /annuler la salle/i }),
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
      screen.queryByRole('button', { name: /actions de la salle/i }),
    ).not.toBeInTheDocument();
  });

  it('membre non-owner : lecture seule + leave dans le menu', async () => {
    const user = userEvent.setup();
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
              currentExercise: null,
              progress: null,
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
              currentExercise: null,
              progress: null,
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
    await user.click(
      screen.getByRole('button', { name: /actions de la salle/i }),
    );
    expect(
      screen.getByRole('menuitem', { name: /quitter/i }),
    ).toBeInTheDocument();
  });

  it('affiche Ta séance en LOBBY sans attach', async () => {
    getSharedWorkoutRoom.mockResolvedValue(roomFixture());
    renderDetail();

    expect(
      await screen.findByRole('heading', { name: /ta séance/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/quand la salle sera lancée/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /rattacher/i }),
    ).not.toBeInTheDocument();
  });

  it('participants ACTIVE : exercice courant + progression sans données privées', async () => {
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
              workoutName: 'Upper Body',
              startedAt: '2026-08-10T11:05:00.000Z',
              completedAt: null,
              currentExercise: {
                name: 'Développé incliné',
                processedSetCount: 2,
                totalSetCount: 4,
              },
              progress: {
                processedSetCount: 8,
                totalSetCount: 15,
                processedExerciseCount: 2,
                totalExerciseCount: 5,
              },
            },
          },
          {
            userId: 'user-b',
            role: 'MEMBER',
            displayName: 'Bob',
            joinedAt: '2026-08-10T10:05:00.000Z',
            memberWorkout: {
              status: 'ACTIVE',
              workoutName: 'Pull',
              startedAt: '2026-08-10T11:05:00.000Z',
              completedAt: null,
              currentExercise: {
                name: 'Tractions',
                processedSetCount: 1,
                totalSetCount: 3,
              },
              progress: {
                processedSetCount: 4,
                totalSetCount: 12,
                processedExerciseCount: 1,
                totalExerciseCount: 4,
              },
            },
          },
        ],
      }),
    );
    renderDetail();

    expect(await screen.findByText(/tractions/i)).toBeInTheDocument();
    expect(screen.getByText(/4 \/ 12 séries/i)).toBeInTheDocument();
    expect(screen.getByText(/33 %/i)).toBeInTheDocument();
    expect(screen.queryByText(/kg/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/rir/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/rpe/i)).not.toBeInTheDocument();
  });

  it('LOBBY : pas de progression workout', async () => {
    getSharedWorkoutRoom.mockResolvedValue(
      roomFixture({
        status: 'LOBBY',
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
              currentExercise: {
                name: 'Ne doit pas s’afficher',
                processedSetCount: 1,
                totalSetCount: 3,
              },
              progress: {
                processedSetCount: 1,
                totalSetCount: 3,
                processedExerciseCount: 0,
                totalExerciseCount: 1,
              },
            },
          },
        ],
      }),
    );
    renderDetail();

    expect(
      await screen.findByRole('heading', { name: /séance duo/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/ne doit pas s’afficher/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('socket down : bandeau Actualiser sans bloquer la room', async () => {
    realtimeState.connectionStatus = 'error';
    realtimeState.realtimeAvailable = false;
    realtimeState.connectedUserIds = new Set();
    getSharedWorkoutRoom.mockResolvedValue(roomFixture());
    renderDetail();

    expect(
      await screen.findByText(/temps réel indisponible/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /actualiser/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /démarrer la séance/i }),
    ).toBeInTheDocument();
  });
});
