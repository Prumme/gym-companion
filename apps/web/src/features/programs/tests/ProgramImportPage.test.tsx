import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProgramImportPage } from '../pages/ProgramImportPage';
import { createProgramDetail } from './fixtures';

const listMuscleGroups = vi.fn();
const listSystemExerciseCatalog = vi.fn();
const validateProgramImport = vi.fn();
const importProgramFromJson = vi.fn();

vi.mock('@/features/exercises/api/exercise-api', async () => {
  const actual = await vi.importActual<
    typeof import('@/features/exercises/api/exercise-api')
  >('@/features/exercises/api/exercise-api');
  return {
    ...actual,
    listMuscleGroups: (...args: unknown[]) => listMuscleGroups(...args),
    listSystemExerciseCatalog: (...args: unknown[]) =>
      listSystemExerciseCatalog(...args),
  };
});

vi.mock('../api/program-import-api', () => ({
  validateProgramImport: (...args: unknown[]) => validateProgramImport(...args),
  importProgramFromJson: (...args: unknown[]) => importProgramFromJson(...args),
}));

const catalog = [
  {
    slug: 'developpe-couche-barre',
    name: 'Développé couché à la barre',
    primaryMuscleCode: 'chest',
    defaultEquipmentCode: 'barbell',
    measurementType: 'WEIGHT_REPS',
  },
  {
    slug: 'chest-press-machine',
    name: 'Chest Press machine',
    primaryMuscleCode: 'chest',
    defaultEquipmentCode: 'machine',
    measurementType: 'WEIGHT_REPS',
  },
];

const validJson = JSON.stringify({
  schemaVersion: 1,
  program: {
    name: 'Push Pull Legs',
    description: null,
    goal: 'HYPERTROPHY',
    workouts: [
      {
        name: 'Push',
        description: null,
        estimatedDurationMinutes: 60,
        exercises: [
          {
            exerciseSlug: 'developpe-couche-barre',
            notes: null,
            sets: [{ repsMin: 8, repsMax: 10, rir: 2, restSeconds: 120 }],
          },
        ],
      },
    ],
  },
});

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/programs/import']}>
        <Routes>
          <Route path="/programs/import" element={children} />
          <Route
            path="/programs/:programId"
            element={<div>Détail programme</div>}
          />
          <Route path="/programs" element={<div>Liste programmes</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return render(<ProgramImportPage />, { wrapper });
}

describe('ProgramImportPage', () => {
  const writeText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    listMuscleGroups.mockReset();
    listSystemExerciseCatalog.mockReset();
    validateProgramImport.mockReset();
    importProgramFromJson.mockReset();
    writeText.mockClear();
    listMuscleGroups.mockResolvedValue([
      { id: 'm1', code: 'chest', name: 'Pectoraux', parentId: null },
      { id: 'm2', code: 'back', name: 'Dos', parentId: null },
    ]);
    listSystemExerciseCatalog.mockResolvedValue(catalog);
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('génère un prompt avec le catalogue et copie sans ouvrir une IA', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(
      await screen.findByRole('heading', { name: /Importer avec une IA/i }),
    ).toBeInTheDocument();

    expect(
      await screen.findByRole('checkbox', { name: 'Pectoraux' }),
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^Objectif/), 'HYPERTROPHY');
    await user.selectOptions(screen.getByLabelText(/Nombre de séances/), '3');
    await user.selectOptions(
      screen.getByLabelText(/Durée approximative par séance/),
      '60',
    );
    await user.selectOptions(screen.getByLabelText(/^Niveau/), 'BEGINNER');
    await user.click(screen.getByRole('checkbox', { name: 'Pectoraux' }));
    await user.selectOptions(
      screen.getByLabelText(/Préférence matériel/),
      'mixed',
    );
    await user.type(
      screen.getByLabelText(/Décris plus précisément ce que tu souhaites/),
      'Je veux surtout développer le haut du corps.',
    );

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Générer le prompt/i }),
      ).toBeEnabled(),
    );

    await user.click(screen.getByRole('button', { name: /Générer le prompt/i }));
    const promptBox = screen.getByDisplayValue(
      /You are generating a gym strength-training program/,
    ) as HTMLTextAreaElement;
    expect(promptBox.value).toContain('developpe-couche-barre');
    expect((promptBox as HTMLTextAreaElement).value).toContain('Return ONLY JSON.');
    expect((promptBox as HTMLTextAreaElement).value).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
    expect((promptBox as HTMLTextAreaElement).value).toContain(
      'Je veux surtout développer le haut du corps.',
    );

    await user.click(screen.getByRole('button', { name: /Copier le prompt/i }));
    expect(await screen.findByText('Prompt copié')).toBeInTheDocument();
    expect(validateProgramImport).not.toHaveBeenCalled();
    expect(importProgramFromJson).not.toHaveBeenCalled();
  });

  it('affiche une erreur de syntaxe sans appeler le backend', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByLabelText(/Colle ici le JSON/);
    fireEvent.change(screen.getByLabelText(/Colle ici le JSON/), {
      target: { value: '{ "broken": ' },
    });
    await user.click(screen.getByRole('button', { name: /Vérifier le JSON/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/JSON invalide/i);
    expect(validateProgramImport).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: /Importer ce programme/i }),
    ).not.toBeInTheDocument();
  });

  it('affiche les erreurs métier, le path et un prompt de correction', async () => {
    const user = userEvent.setup();
    validateProgramImport.mockResolvedValue({
      valid: false,
      preview: null,
      errors: [
        {
          path: 'program.workouts[0].exercises[0].exerciseSlug',
          code: 'UNKNOWN_EXERCISE',
          message: 'Exercice inconnu : fake-chest-machine.',
          suggestions: ['chest-press-machine'],
        },
      ],
    });
    renderPage();
    await screen.findByLabelText(/Colle ici le JSON/);
    fireEvent.change(screen.getByLabelText(/Colle ici le JSON/), {
      target: {
        value: JSON.stringify({
          schemaVersion: 1,
          program: {
            name: 'P',
            description: null,
            goal: 'HYPERTROPHY',
            workouts: [
              {
                name: 'Push',
                description: null,
                estimatedDurationMinutes: 60,
                exercises: [
                  {
                    exerciseSlug: 'fake-chest-machine',
                    sets: [{ repsMin: 8, repsMax: 10 }],
                  },
                ],
              },
            ],
          },
        }),
      },
    });
    await user.click(screen.getByRole('button', { name: /Vérifier le JSON/i }));
    expect(await screen.findByText(/1 erreur trouvée/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Exercice inconnu : fake-chest-machine/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/chest-press-machine/)).toBeInTheDocument();
    expect(
      screen.getByText('program.workouts[0].exercises[0].exerciseSlug'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Importer ce programme/i }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: /Copier un prompt de correction/i }),
    );
    expect(
      await screen.findByText('Prompt de correction copié'),
    ).toBeInTheDocument();
  });

  it('prévisualise puis importe un JSON valide', async () => {
    const user = userEvent.setup();
    validateProgramImport.mockResolvedValue({
      valid: true,
      errors: [],
      preview: {
        name: 'Push Pull Legs',
        description: null,
        goal: 'HYPERTROPHY',
        workoutCount: 1,
        exerciseCount: 1,
        setCount: 1,
        workouts: [
          {
            name: 'Push',
            description: null,
            estimatedDurationMinutes: 60,
            exercises: [
              {
                exerciseSlug: 'developpe-couche-barre',
                name: 'Développé couché à la barre',
                measurementType: 'WEIGHT_REPS',
                notes: null,
                sets: [
                  {
                    repsMin: 8,
                    repsMax: 10,
                    durationSeconds: null,
                    distanceMeters: null,
                    weightKg: null,
                    rir: 2,
                    rpe: null,
                    restSeconds: 120,
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    importProgramFromJson.mockResolvedValue(
      createProgramDetail({ status: 'DRAFT', isCurrent: false }),
    );

    renderPage();
    await screen.findByLabelText(/Colle ici le JSON/);
    fireEvent.change(screen.getByLabelText(/Colle ici le JSON/), {
      target: { value: validJson },
    });
    await user.click(screen.getByRole('button', { name: /Vérifier le JSON/i }));

    expect(await screen.findByText('JSON valide')).toBeInTheDocument();
    expect(screen.getByText('Push Pull Legs')).toBeInTheDocument();
    expect(screen.getByText(/Développé couché à la barre/)).toBeInTheDocument();
    expect(screen.getByText(/1 × 8–10/)).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: /Importer ce programme/i }),
    );
    await waitFor(() => expect(importProgramFromJson).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Détail programme')).toBeInTheDocument();
  });
});
