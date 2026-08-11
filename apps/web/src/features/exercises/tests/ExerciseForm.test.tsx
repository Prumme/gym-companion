import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, type Mock } from 'vitest';

import { ExerciseForm } from '../components/ExerciseForm';
import {
  EMPTY_EXERCISE_FORM_VALUES,
  type ExerciseFormValues,
} from '../lib/exercise-form';

const MUSCLE_CHEST = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const MUSCLE_BACK = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const MUSCLE_TRICEPS = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const EQ_BARBELL = '11111111-1111-1111-1111-111111111111';
const EQ_DUMBBELL = '22222222-2222-2222-2222-222222222222';

const muscleGroups = [
  { id: MUSCLE_CHEST, code: 'chest', name: 'Pectoraux', parentId: null },
  { id: MUSCLE_BACK, code: 'back', name: 'Dos', parentId: null },
  { id: MUSCLE_TRICEPS, code: 'triceps', name: 'Triceps', parentId: null },
];

const equipmentTypes = [
  { id: EQ_BARBELL, code: 'barbell', name: 'Barre' },
  { id: EQ_DUMBBELL, code: 'dumbbell', name: 'Haltères' },
];

type SubmitFn = (values: ExerciseFormValues) => Promise<void> | void;

function renderForm(
  props: Partial<Omit<ComponentProps<typeof ExerciseForm>, 'onSubmit'>> & {
    onSubmit?: Mock<SubmitFn>;
  } = {},
) {
  const onSubmit = props.onSubmit ?? vi.fn<SubmitFn>();
  const { onSubmit: _ignored, ...rest } = props;
  render(
    <MemoryRouter>
      <ExerciseForm
        mode="create"
        initialValues={EMPTY_EXERCISE_FORM_VALUES}
        muscleGroups={muscleGroups}
        equipmentTypes={equipmentTypes}
        cancelTo="/exercises"
        {...rest}
        onSubmit={onSubmit}
      />
    </MemoryRouter>,
  );
  return { onSubmit };
}

describe('ExerciseForm', () => {
  it('renders create form with initial values', () => {
    renderForm();
    expect(screen.getByLabelText(/Nom/i)).toHaveValue('');
    expect(screen.getByLabelText(/Muscle principal/i)).toHaveValue('');
    expect(screen.getByLabelText(/Type de mesure/i)).toHaveValue('WEIGHT_REPS');
    expect(
      screen.getByRole('button', { name: /Créer l’exercice/i }),
    ).toBeInTheDocument();
  });

  it('requires name and primary muscle group', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.click(screen.getByRole('button', { name: /Créer l’exercice/i }));
    expect(await screen.findByText(/Le nom est requis/i)).toBeInTheDocument();
    expect(
      await screen.findByText(/Sélectionne un groupe musculaire principal/i),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a valid payload once and blocks double submit while pending', async () => {
    const user = userEvent.setup();
    let resolveSubmit: (() => void) | undefined;
    const onSubmit = vi.fn<SubmitFn>(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    renderForm({ onSubmit });

    await user.type(screen.getByLabelText(/Nom/i), 'Tirage poitrine');
    await user.selectOptions(
      screen.getByLabelText(/Muscle principal/i),
      MUSCLE_CHEST,
    );
    await user.selectOptions(
      screen.getByLabelText(/Type de mesure/i),
      'REPS_ONLY',
    );

    await user.click(screen.getByRole('button', { name: /Créer l’exercice/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    const values = onSubmit.mock.calls[0]?.[0] as ExerciseFormValues;
    expect(values.name).toBe('Tirage poitrine');
    expect(values.primaryMuscleGroupId).toBe(MUSCLE_CHEST);
    expect(values.measurementType).toBe('REPS_ONLY');

    resolveSubmit?.();
  });

  it('shows Création… when pending and keeps values on error', async () => {
    const user = userEvent.setup();
    renderForm({
      pending: true,
      submitError: 'Erreur réseau',
      initialValues: {
        ...EMPTY_EXERCISE_FORM_VALUES,
        name: 'Conserve-moi',
        primaryMuscleGroupId: MUSCLE_BACK,
      },
    });

    expect(screen.getByRole('button', { name: /Création…/i })).toBeDisabled();
    expect(screen.getByLabelText(/Nom/i)).toHaveValue('Conserve-moi');
    expect(screen.getByText('Erreur réseau')).toBeInTheDocument();
    await user.click(screen.getByLabelText(/Nom/i));
  });

  it('allows secondary muscles except the primary', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.selectOptions(
      screen.getByLabelText(/Muscle principal/i),
      MUSCLE_CHEST,
    );

    const triceps = screen.getByRole('checkbox', { name: /Triceps/i });
    const chestAsSecondary = screen.queryByRole('checkbox', {
      name: /^Pectoraux$/i,
    });
    expect(chestAsSecondary).not.toBeInTheDocument();
    await user.click(triceps);
    expect(triceps).toBeChecked();
  });

  it('limits default equipment to compatible ones and clears rest empty', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/Nom/i), 'Développé');
    await user.selectOptions(
      screen.getByLabelText(/Muscle principal/i),
      MUSCLE_CHEST,
    );
    await user.selectOptions(
      screen.getByLabelText(/Ajouter un équipement compatible/i),
      EQ_BARBELL,
    );
    await user.click(screen.getByRole('button', { name: /^Ajouter$/i }));

    const defaultSelect = screen.getByLabelText(/Équipement par défaut/i);
    expect(withinOptions(defaultSelect)).toContain('Barre');
    expect(withinOptions(defaultSelect)).not.toContain('Haltères');
    await user.selectOptions(defaultSelect, EQ_BARBELL);

    await user.clear(screen.getByLabelText(/Repos par défaut/i));
    await user.type(screen.getByLabelText(/Instructions/i), 'Descente lente');

    await user.click(screen.getByRole('button', { name: /Créer l’exercice/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const values = onSubmit.mock.calls[0]?.[0] as ExerciseFormValues;
    expect(values.defaultEquipmentTypeId).toBe(EQ_BARBELL);
    expect(values.defaultRestSeconds).toBe('');
    expect(values.instructions).toBe('Descente lente');
  });

  it('rejects invalid rest seconds', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.type(screen.getByLabelText(/Nom/i), 'Test');
    await user.selectOptions(
      screen.getByLabelText(/Muscle principal/i),
      MUSCLE_CHEST,
    );
    await user.type(screen.getByLabelText(/Repos par défaut/i), '99999');
    await user.click(screen.getByRole('button', { name: /Créer l’exercice/i }));
    expect(
      await screen.findByText(/Le repos doit être entre 0 et 3600/i),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

function withinOptions(select: HTMLElement): string[] {
  return Array.from(select.querySelectorAll('option')).map(
    (option) => option.textContent ?? '',
  );
}
