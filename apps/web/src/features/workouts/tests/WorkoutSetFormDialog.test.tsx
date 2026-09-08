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
  client.setQueryData(['me'], {
    data: {
      id: 'user-1',
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
    },
  });

  render(
    <QueryClientProvider client={client}>
      <WorkoutSetFormDialog
        open
        workoutSessionId="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
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

  return { onClose, onVersionConflict, client };
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
    ['DISTANCE_DURATION', { reps: false, weight: false, duration: true, distance: true }],
    ['WEIGHT_DURATION', { reps: false, weight: true, duration: true, distance: false }],
  ] as const)('affiche les champs adaptés à %s', (measurementType, visibility) => {
    renderDialog({
      measurementType: measurementType as ExerciseMeasurementType,
      set: createWorkoutSet({
        targetWeightKg: measurementType.includes('WEIGHT') ? 40 : null,
        targetRepMin: measurementType.includes('REPS') ? 12 : null,
        targetRepMax: measurementType.includes('REPS') ? 12 : null,
        targetDurationSeconds: measurementType.includes('DURATION') ? 45 : null,
        targetDistanceMeters: measurementType.includes('DISTANCE') ? 1000 : null,
        targetRir: null,
      }),
      effortTrackingMode: 'NONE',
    });
    const dialog = screen.getByRole('dialog');
    expect(Boolean(within(dialog).queryByLabelText(/^Répétitions$/i))).toBe(visibility.reps);
    expect(Boolean(within(dialog).queryByLabelText(/Charge \(kg\)|Assistance/i))).toBe(
      visibility.weight,
    );
    expect(Boolean(within(dialog).queryByLabelText(/Durée \(secondes\)/i))).toBe(
      visibility.duration,
    );
    expect(Boolean(within(dialog).queryByLabelText(/Distance \(mètres\)/i))).toBe(
      visibility.distance,
    );
    expect(within(dialog).queryByLabelText(/^RIR$/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/^RPE$/i)).not.toBeInTheDocument();
  });

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
      await screen.findByText(/La séance a été modifiée depuis un autre onglet ou appareil/i),
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

  it('autorise la saisie hors ligne (file locale)', async () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false,
    });
    renderDialog();
    expect(
      screen.queryByText(/Une connexion est nécessaire pour enregistrer cette série/i),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Enregistrer$/i })).not.toBeDisabled();
  });

  it('n’affiche pas l’action de copie sur la première série', () => {
    renderDialog();
    expect(
      screen.queryByRole('button', { name: /Copier la série précédente/i }),
    ).not.toBeInTheDocument();
  });

  it('copie WEIGHT_REPS depuis la série précédente sans persister tout de suite', async () => {
    const user = userEvent.setup();
    const current = createWorkoutSet({
      id: 'ws-2',
      position: 1,
      targetWeightKg: 60,
      targetRepMin: 8,
      targetRepMax: 10,
      targetRir: 2,
    });
    renderDialog({
      set: current,
      previousSet: createWorkoutSet({
        id: 'ws-1',
        position: 0,
        status: 'COMPLETED',
        actualWeightKg: 70,
        actualReps: 10,
        actualRir: 0,
        actualRpe: 9,
        reachedFailure: true,
        notes: 'Série 1',
      }),
    });
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText(/Charge \(kg\)/i)).toHaveValue(60);
    expect(within(dialog).getByText(/8–10 reps/)).toBeInTheDocument();
    expect(within(dialog).getByText(/60 kg/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /^Copier la série précédente$/i }));

    expect(within(dialog).getByLabelText(/Charge \(kg\)/i)).toHaveValue(70);
    expect(within(dialog).getByLabelText(/^Répétitions$/i)).toHaveValue(10);
    expect(within(dialog).getByLabelText(/^RIR$/i)).toHaveValue(2);
    expect(within(dialog).getByLabelText(/Échec musculaire/i)).not.toBeChecked();
    expect(within(dialog).getByText(/8–10 reps/)).toBeInTheDocument();
    expect(within(dialog).getByText(/60 kg/)).toBeInTheDocument();
    expect(updateWorkoutSet).not.toHaveBeenCalled();
  });

  it('copie DURATION depuis la série précédente', async () => {
    const user = userEvent.setup();
    renderDialog({
      measurementType: 'DURATION',
      effortTrackingMode: 'NONE',
      set: createWorkoutSet({
        id: 'ws-2',
        position: 1,
        targetDurationSeconds: 30,
        targetWeightKg: null,
        targetRepMin: null,
        targetRepMax: null,
        targetRir: null,
      }),
      previousSet: createWorkoutSet({
        id: 'ws-1',
        status: 'COMPLETED',
        actualDurationSeconds: 45,
        actualWeightKg: 70,
        actualReps: 10,
      }),
    });
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText(/Durée \(secondes\)/i)).toHaveValue(30);
    await user.click(within(dialog).getByRole('button', { name: /^Copier la série précédente$/i }));
    expect(within(dialog).getByLabelText(/Durée \(secondes\)/i)).toHaveValue(45);
    expect(updateWorkoutSet).not.toHaveBeenCalled();
  });

  it('copie uniquement les valeurs présentes d’une série précédente partielle', async () => {
    const user = userEvent.setup();
    renderDialog({
      set: createWorkoutSet({
        id: 'ws-2',
        position: 1,
        targetWeightKg: 60,
        targetRepMax: 10,
      }),
      previousSet: createWorkoutSet({
        status: 'PARTIAL',
        actualWeightKg: 70,
        actualReps: null,
      }),
    });
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^Copier la série précédente$/i }));
    expect(within(dialog).getByLabelText(/Charge \(kg\)/i)).toHaveValue(70);
    expect(within(dialog).getByLabelText(/^Répétitions$/i)).toHaveValue(10);
  });

  it('désactive la copie si la série précédente est vide', () => {
    renderDialog({
      set: createWorkoutSet({ id: 'ws-2', position: 1 }),
      previousSet: createWorkoutSet({
        status: 'PENDING',
        actualWeightKg: null,
        actualReps: null,
      }),
    });
    expect(
      screen.getByRole('button', {
        name: /Copier la série précédente.*n’a pas de valeurs/i,
      }),
    ).toBeDisabled();
  });

  it('ne modifie pas une série COMPLETED via la copie', () => {
    renderDialog({
      set: createWorkoutSet({
        id: 'ws-2',
        position: 1,
        status: 'COMPLETED',
        actualWeightKg: 55,
        actualReps: 8,
        actualRir: 1,
      }),
      previousSet: createWorkoutSet({
        status: 'COMPLETED',
        actualWeightKg: 70,
        actualReps: 10,
      }),
    });
    const dialog = screen.getByRole('dialog');
    const copy = within(dialog).getByRole('button', {
      name: /Copier la série précédente.*déjà terminée/i,
    });
    expect(copy).toBeDisabled();
    expect(within(dialog).getByLabelText(/Charge \(kg\)/i)).toHaveValue(55);
    expect(within(dialog).getByLabelText(/^Répétitions$/i)).toHaveValue(8);
    expect(updateWorkoutSet).not.toHaveBeenCalled();
  });

  it('fonctionne sur un exercice ajouté à la volée', async () => {
    const user = userEvent.setup();
    renderDialog({
      sessionExerciseId: 'wse-adhoc',
      set: createWorkoutSet({
        id: 'ws-2',
        position: 1,
        targetWeightKg: null,
        targetRepMin: null,
        targetRepMax: null,
        targetRir: null,
      }),
      previousSet: createWorkoutSet({
        actualWeightKg: 50,
        actualReps: 12,
      }),
    });
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^Copier la série précédente$/i }));
    expect(within(dialog).getByLabelText(/Charge \(kg\)/i)).toHaveValue(50);
    expect(within(dialog).getByLabelText(/^Répétitions$/i)).toHaveValue(12);
  });

  it('fonctionne sur un exercice remplacé (même flux, même exercice de séance)', async () => {
    const user = userEvent.setup();
    renderDialog({
      sessionExerciseId: 'wse-replaced',
      set: createWorkoutSet({
        id: 'ws-2',
        position: 1,
        targetWeightKg: 40,
        targetRepMax: 8,
      }),
      previousSet: createWorkoutSet({
        actualWeightKg: 80,
        actualReps: 6,
      }),
    });
    await user.click(screen.getByRole('button', { name: /^Copier la série précédente$/i }));
    expect(screen.getByLabelText(/Charge \(kg\)/i)).toHaveValue(80);
    expect(screen.getByLabelText(/^Répétitions$/i)).toHaveValue(6);
  });

  it('enregistre les valeurs copiées sans RIR/notes de la série précédente', async () => {
    const user = userEvent.setup();
    updateWorkoutSet.mockResolvedValue({
      workoutSet: createWorkoutSet({
        id: 'ws-2',
        position: 1,
        status: 'COMPLETED',
        actualWeightKg: 70,
        actualReps: 10,
      }),
      workoutSessionVersion: 2,
    });
    renderDialog({
      set: createWorkoutSet({ id: 'ws-2', position: 1 }),
      previousSet: createWorkoutSet({
        status: 'COMPLETED',
        actualWeightKg: 70,
        actualReps: 10,
        actualRir: 0,
        notes: 'Ne pas copier',
        reachedFailure: true,
      }),
    });
    await user.click(screen.getByRole('button', { name: /^Copier la série précédente$/i }));
    await user.click(screen.getByRole('button', { name: /^Enregistrer$/i }));
    await waitFor(() => expect(updateWorkoutSet).toHaveBeenCalledTimes(1));
    expect(updateWorkoutSet.mock.calls[0]?.[3]).toMatchObject({
      status: 'COMPLETED',
      actualWeightKg: 70,
      actualReps: 10,
      actualRir: 2,
      reachedFailure: false,
      notes: null,
    });
  });

  it('copie hors ligne sans appeler l’API', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false,
    });
    renderDialog({
      set: createWorkoutSet({ id: 'ws-2', position: 1 }),
      previousSet: createWorkoutSet({
        actualWeightKg: 70,
        actualReps: 10,
      }),
    });
    await user.click(screen.getByRole('button', { name: /^Copier la série précédente$/i }));
    expect(screen.getByLabelText(/Charge \(kg\)/i)).toHaveValue(70);
    expect(updateWorkoutSet).not.toHaveBeenCalled();
  });
});
