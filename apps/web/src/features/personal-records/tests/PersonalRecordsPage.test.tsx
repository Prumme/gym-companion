import type { PersonalRecord } from '@gym-companion/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PersonalRecordsPage } from '../pages/PersonalRecordsPage';

const listPersonalRecords = vi.fn();
const getMe = vi.fn();

vi.mock('../api/personal-records-api', () => ({
  listPersonalRecords: (...args: unknown[]) => listPersonalRecords(...args),
  listExercisePersonalRecords: vi.fn(),
}));

vi.mock('@/features/profile/api/profile-api', () => ({
  getMe: (...args: unknown[]) => getMe(...args),
}));

vi.mock('@/features/workouts/offline/store', async () => {
  const actual = await vi.importActual<
    typeof import('@/features/workouts/offline/store')
  >('@/features/workouts/offline/store');
  return {
    ...actual,
    listPendingTerminalSnapshots: vi.fn().mockResolvedValue([]),
  };
});

function meResponse() {
  return {
    data: {
      id: 'u1',
      email: 'a@example.com',
      status: 'ACTIVE',
      role: 'USER',
      profile: {
        displayName: 'A',
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
  };
}

function record(
  overrides: Partial<PersonalRecord> &
    Pick<PersonalRecord, 'recordType' | 'value'>,
): PersonalRecord {
  return {
    exerciseId: 'ex-1',
    exercise: {
      id: 'ex-1',
      name: 'Développé couché',
      measurementType: 'WEIGHT_REPS',
      archived: false,
    },
    equipment: { id: 'eq-1', name: 'Barre' },
    context: {
      weightKg: 100,
      reps: 8,
      durationSeconds: null,
      distanceMeters: null,
      rir: 2,
      rpe: null,
      reachedFailure: false,
      setType: 'WORKING',
    },
    achievedOn: '2026-08-12',
    achievedAt: '2026-08-12T10:00:00.000Z',
    source: {
      workoutSessionId: 'ws-1',
      workoutSessionExerciseId: 'wse-1',
      workoutSetId: 'set-1',
    },
    ...overrides,
  };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/records']}>
        <Routes>
          <Route path="/records" element={<PersonalRecordsPage />} />
          <Route path="/progress" element={<div>Progression</div>} />
          <Route
            path="/progress/exercises/:id"
            element={<div>Progression exercice</div>}
          />
          <Route path="/programs" element={<div>Programmes</div>} />
          <Route path="/workouts" element={<div>Historique</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PersonalRecordsPage', () => {
  beforeEach(() => {
    listPersonalRecords.mockReset();
    getMe.mockReset();
    getMe.mockResolvedValue(meResponse());
  });

  it('affiche l’état vide', async () => {
    listPersonalRecords.mockResolvedValue({
      data: [],
      pagination: { nextCursor: null, hasMore: false },
    });
    renderPage();
    expect(
      await screen.findByRole('heading', { name: 'Records personnels' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Aucun record pour le moment.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Voir mes programmes' }),
    ).toHaveAttribute('href', '/programs');
    expect(
      screen.getByRole('link', { name: 'Voir mon historique' }),
    ).toHaveAttribute('href', '/workouts');
  });

  it('affiche hero, types de records et navigation compacte', async () => {
    listPersonalRecords.mockResolvedValue({
      data: [
        record({
          recordType: 'MAX_WEIGHT',
          value: 100,
        }),
        record({
          recordType: 'MAX_REPS',
          value: 15,
          equipment: { id: null, name: null },
          source: {
            workoutSessionId: 'ws-2',
            workoutSessionExerciseId: 'wse-1',
            workoutSetId: 'set-2',
          },
          context: {
            weightKg: 70,
            reps: 15,
            durationSeconds: null,
            distanceMeters: null,
            rir: null,
            rpe: null,
            reachedFailure: false,
            setType: 'WORKING',
          },
        }),
        record({
          exerciseId: 'ex-2',
          exercise: {
            id: 'ex-2',
            name: 'Planche',
            measurementType: 'DURATION',
            archived: false,
          },
          recordType: 'MAX_DURATION',
          value: 120,
          equipment: { id: null, name: null },
          source: {
            workoutSessionId: 'ws-3',
            workoutSessionExerciseId: 'wse-2',
            workoutSetId: 'set-3',
          },
          context: {
            weightKg: null,
            reps: null,
            durationSeconds: 120,
            distanceMeters: null,
            rir: null,
            rpe: null,
            reachedFailure: false,
            setType: 'WORKING',
          },
        }),
        record({
          exerciseId: 'ex-3',
          exercise: {
            id: 'ex-3',
            name: 'Course',
            measurementType: 'DISTANCE_DURATION',
            archived: false,
          },
          recordType: 'MAX_DISTANCE',
          value: 1500,
          equipment: { id: null, name: null },
          source: {
            workoutSessionId: 'ws-4',
            workoutSessionExerciseId: 'wse-3',
            workoutSetId: 'set-4',
          },
          context: {
            weightKg: null,
            reps: null,
            durationSeconds: 400,
            distanceMeters: 1500,
            rir: null,
            rpe: null,
            reachedFailure: false,
            setType: 'WORKING',
          },
        }),
      ],
      pagination: { nextCursor: null, hasMore: false },
    });

    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'Dernier record battu' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Développé couché').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Charge maximale').length).toBeGreaterThan(0);
    expect(screen.getAllByText('100 kg').length).toBeGreaterThan(0);
    expect(screen.getByText(/8 répétitions/)).toBeInTheDocument();
    expect(screen.getByText(/Barre/)).toBeInTheDocument();
    expect(screen.getByText('Répétitions maximales')).toBeInTheDocument();
    expect(screen.getByText('15 répétitions')).toBeInTheDocument();
    expect(screen.getByText('Durée maximale')).toBeInTheDocument();
    expect(screen.getByText('2 min')).toBeInTheDocument();
    expect(screen.getByText('Distance maximale')).toBeInTheDocument();
    expect(screen.getByText(/1[\s\u202f]?500 m/)).toBeInTheDocument();
    expect(screen.getAllByText(/12 août 2026/).length).toBeGreaterThan(0);

    expect(
      screen.getByRole('link', { name: /Charge maximale : 100 kg/i }),
    ).toHaveAttribute('href', '/progress/exercises/ex-1');
  });

  it('gère erreur initiale et pagination', async () => {
    const user = userEvent.setup();
    listPersonalRecords
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({
        data: [
          record({
            recordType: 'MAX_WEIGHT',
            value: 90,
            source: {
              workoutSessionId: 'ws-a',
              workoutSessionExerciseId: 'wse-a',
              workoutSetId: 'set-a',
            },
          }),
        ],
        pagination: { nextCursor: 'cursor-1', hasMore: true },
      })
      .mockResolvedValueOnce({
        data: [
          record({
            exerciseId: 'ex-2',
            exercise: {
              id: 'ex-2',
              name: 'Squat',
              measurementType: 'WEIGHT_REPS',
              archived: false,
            },
            recordType: 'MAX_WEIGHT',
            value: 140,
            source: {
              workoutSessionId: 'ws-b',
              workoutSessionExerciseId: 'wse-b',
              workoutSetId: 'set-b',
            },
          }),
        ],
        pagination: { nextCursor: null, hasMore: false },
      });

    renderPage();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect((await screen.findAllByText('90 kg')).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Charger plus' }));
    expect(await screen.findByText('Squat')).toBeInTheDocument();
    expect(screen.getAllByText('140 kg').length).toBeGreaterThan(0);
  });

  it('reste lisible en largeur mobile', async () => {
    listPersonalRecords.mockResolvedValue({
      data: [record({ recordType: 'MAX_WEIGHT', value: 100 })],
      pagination: { nextCursor: null, hasMore: false },
    });
    const { container } = renderPage();
    expect((await screen.findAllByText('100 kg')).length).toBeGreaterThan(0);
    Object.defineProperty(container.firstChild, 'clientWidth', {
      configurable: true,
      value: 320,
    });
    expect(screen.getAllByText('Charge maximale').length).toBeGreaterThan(0);
    expect(container.querySelector('table')).toBeNull();
  });
});
