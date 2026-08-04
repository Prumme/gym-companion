import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ExerciseMeasurementType } from '@gym-companion/shared';

import { WorkoutSetFormDialog } from '../components/WorkoutSetFormDialog';
import { createWorkoutSet } from './fixtures';

const updateWorkoutSet = vi.fn();

vi.mock('../api/workout-api', () => ({
  updateWorkoutSet: (...args: unknown[]) => updateWorkoutSet(...args),
  getActiveWorkoutSession: vi.fn(),
  createWorkoutSession: vi.fn(),
  getWorkoutSessionDetail: vi.fn(),
}));

type Props = ComponentProps<typeof WorkoutSetFormDialog>;

function renderDialog(overrides: Partial<Props> = {}) {
  const onClose = overrides.onClose ?? vi.fn();
  const onVersionConflict = overrides.onVersionConflict ?? vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={client}>
      <WorkoutSetFormDialog
        open
        workoutSessionId="sess-1"
        sessionExerciseId="wse-1"
        measurementType="WEIGHT_REPS"
        effortTrackingMode="RIR"
        expectedVersion={1}
        set={createWorkoutSet()}
        onClose={onClose}
        onVersionConflict={onVersionConflict}
        {...overrides}
      />
    </QueryClientProvider>,
  );

  return { onClose, onVersionConflict };
}

describe('WorkoutSetFormDialog', () => {
  beforeEach(() => {
    updateWorkoutSet.mockReset();
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    });
  });

  it('préremplit depuis les cibles pour une série PENDING WEIGHT_REPS', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText(/Charge \(kg\)/i)).toHaveValue(60);
    expect(within(dialog).getByLabelText(/^Répétitions$/i)).toHaveValue(10);
    expect(within(dialog).getByLabelText(/^RIR$/i)).toHaveValue(2);
    expect(within(dialog).queryByLabelText(/^RPE$/i)).not.toBeInTheDocument();
  });

  it('préremplit depuis la performance existante', () => {
    renderDialog({
      set: createWorkoutSet({
        status: 'COMPLETED',
        actualWeightKg: 55,
        actualReps: 9,
        actualRir: 1,
        reachedFailure: true,
        notes: 'Bonne série',
      }),
    });
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText(/Charge \(kg\)/i)).toHaveValue(55);
    expect(within(dialog).getByLabelText(/^Répétitions$/i)).toHaveValue(9);
    expect(within(dialog).getByLabelText(/^RIR$/i)).toHaveValue(1);
    expect(within(dialog).getByLabelText(/Échec musculaire/i)).toBeChecked();
    expect(within(dialog).getByLabelText(/^Notes$/i)).toHaveValue('Bonne série');
  });

  it.each([
    ['REPS_ONLY', { reps: true, weight: false, duration: false, distance: false }],
    ['DURATION', { reps: false, weight: false, duration: true, distance: false }],
    [
      'DISTANCE_DURATION',
      { reps: false, weight: false, duration: true, distance: true },
    ],
    [
      'WEIGHT_DURATION',
      { reps: false, weight: true, duration: true, distance: false },
    ],
  ] as const)(
    'affiche les champs adaptés à %s',
    (measurementType, visibility) => {
      renderDialog({
        measurementType: measurementType as ExerciseMeasurementType,
        set: createWorkoutSet({
          targetWeightKg: measurementType.includes('WEIGHT') ? 40 : null,
          targetRepMin: measurementType.includes('REPS') ? 12 : null,
          targetRepMax: measurementType.includes('REPS') ? 12 : null,
          targetDurationSeconds: measurementType.includes('DURATION')
            ? 45
            : null,
          targetDistanceMeters: measurementType.includes('DISTANCE')
            ? 1000
            : null,
          targetRir: null,
        }),
        effortTrackingMode: 'NONE',
      });
      const dialog = screen.getByRole('dialog');
      expect(Boolean(within(dialog).queryByLabelText(/^Répétitions$/i))).toBe(
        visibility.reps,
      );
      expect(
        Boolean(within(dialog).queryByLabelText(/Charge \(kg\)|Assistance/i)),
      ).toBe(visibility.weight);
      expect(
        Boolean(within(dialog).queryByLabelText(/Durée \(secondes\)/i)),
      ).toBe(visibility.duration);
      expect(
        Boolean(within(dialog).queryByLabelText(/Distance \(mètres\)/i)),
      ).toBe(visibility.distance);
      expect(within(dialog).queryByLabelText(/^RIR$/i)).not.toBeInTheDocument();
      expect(within(dialog).queryByLabelText(/^RPE$/i)).not.toBeInTheDocument();
    },
  );

  it('affiche RPE sans RIR selon le profil', () => {
    renderDialog({
      effortTrackingMode: 'RPE',
      set: createWorkoutSet({ targetRir: null, targetRpe: 8 }),
    });
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText(/^RPE$/i)).toHaveValue(8);
    expect(within(dialog).queryByLabelText(/^RIR$/i)).not.toBeInTheDocument();
  });

  it('enregistre et empêche la double soumission', async () => {
    const user = userEvent.setup();
    let resolveUpdate: ((value: unknown) => void) | undefined;
    updateWorkoutSet.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve;
        }),
    );
    const { onClose } = renderDialog();

    const submit = screen.getByRole('button', { name: /^Enregistrer$/i });
    await user.click(submit);
    expect(submit).toBeDisabled();
    expect(screen.getByRole('button', { name: /Enregistrement/i })).toBeDisabled();

    resolveUpdate?.({
      workoutSet: createWorkoutSet({
        status: 'COMPLETED',
        actualWeightKg: 60,
        actualReps: 10,
      }),
      workoutSessionVersion: 2,
    });

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(updateWorkoutSet).toHaveBeenCalledTimes(1);
    expect(updateWorkoutSet.mock.calls[0]?.[3]).toMatchObject({
      status: 'COMPLETED',
      actualWeightKg: 60,
      actualReps: 10,
      expectedVersion: 1,
    });
  });

  it('conserve les valeurs après une erreur API', async () => {
    const user = userEvent.setup();
    updateWorkoutSet.mockRejectedValue(
      Object.assign(new Error('Série invalide'), {
        code: 'WORKOUT_SET_INVALID',
        status: 400,
      }),
    );
    renderDialog();
    const dialog = screen.getByRole('dialog');
    await user.clear(within(dialog).getByLabelText(/^Répétitions$/i));
    await user.type(within(dialog).getByLabelText(/^Répétitions$/i), '7');
    await user.click(within(dialog).getByRole('button', { name: /^Enregistrer$/i }));

    expect(await within(dialog).findByRole('alert')).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^Répétitions$/i)).toHaveValue(7);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('signale un conflit de version et notifie le parent', async () => {
    const user = userEvent.setup();
    updateWorkoutSet.mockRejectedValue(
      Object.assign(new Error('Version conflict'), {
        code: 'WORKOUT_VERSION_CONFLICT',
        status: 409,
      }),
    );
    const { onVersionConflict, onClose } = renderDialog();
    await user.click(screen.getByRole('button', { name: /^Enregistrer$/i }));

    expect(
      await screen.findByText(
        /La séance a été modifiée depuis un autre onglet ou appareil/i,
      ),
    ).toBeInTheDocument();
    expect(onVersionConflict).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ignore une série via le même flux de mutation', async () => {
    const user = userEvent.setup();
    updateWorkoutSet.mockResolvedValue({
      workoutSet: createWorkoutSet({ status: 'SKIPPED', completedAt: '2026-08-04T10:05:00.000Z' }),
      workoutSessionVersion: 2,
    });
    const { onClose } = renderDialog();
    await user.click(screen.getByRole('button', { name: /Ignorer la série/i }));

    await waitFor(() => expect(updateWorkoutSet).toHaveBeenCalledTimes(1));
    expect(updateWorkoutSet.mock.calls[0]?.[3]).toMatchObject({
      status: 'SKIPPED',
      actualReps: null,
      actualWeightKg: null,
      reachedFailure: false,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('permet de marquer une série comme échouée', async () => {
    const user = userEvent.setup();
    updateWorkoutSet.mockResolvedValue({
      workoutSet: createWorkoutSet({
        status: 'FAILED',
        actualWeightKg: 60,
        actualReps: 0,
      }),
      workoutSessionVersion: 2,
    });
    renderDialog();
    await user.selectOptions(screen.getByLabelText(/^Statut$/i), 'FAILED');
    await user.clear(screen.getByLabelText(/^Répétitions$/i));
    await user.type(screen.getByLabelText(/^Répétitions$/i), '0');
    await user.click(screen.getByRole('button', { name: /^Enregistrer$/i }));

    await waitFor(() => expect(updateWorkoutSet).toHaveBeenCalledTimes(1));
    expect(updateWorkoutSet.mock.calls[0]?.[3]).toMatchObject({
      status: 'FAILED',
      actualReps: 0,
    });
  });

  it('bloque l’enregistrement hors ligne', async () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false,
    });
    renderDialog();
    expect(
      screen.getByText(/Une connexion est nécessaire pour enregistrer cette série/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Enregistrer$/i })).toBeDisabled();
  });
});
