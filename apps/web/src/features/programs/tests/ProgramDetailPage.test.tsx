import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProgramDetailPage } from '../pages/ProgramDetailPage';
import {
  createActiveProgramSummary,
  createProgramDetail,
  createTemplate,
  createTemplateExercise,
} from './fixtures';

const getProgram = vi.fn();
const getActiveProgram = vi.fn();
const activateProgram = vi.fn();
const deactivateProgram = vi.fn();
const archiveProgram = vi.fn();
const restoreProgram = vi.fn();
const createWorkoutTemplate = vi.fn();
const deleteWorkoutTemplate = vi.fn();
const reorderWorkoutTemplates = vi.fn();
const getActiveWorkoutSession = vi.fn();
const getMe = vi.fn();
const getLoadRecommendation = vi.fn();
const listLoadRecommendationDecisions = vi.fn();

vi.mock('../api/program-api', async () => {
  const actual = await vi.importActual<typeof import('../api/program-api')>(
    '../api/program-api',
  );
  return {
    ...actual,
    getProgram: (...args: unknown[]) => getProgram(...args),
    getActiveProgram: (...args: unknown[]) => getActiveProgram(...args),
    activateProgram: (...args: unknown[]) => activateProgram(...args),
    deactivateProgram: (...args: unknown[]) => deactivateProgram(...args),
    archiveProgram: (...args: unknown[]) => archiveProgram(...args),
    restoreProgram: (...args: unknown[]) => restoreProgram(...args),
    createWorkoutTemplate: (...args: unknown[]) => createWorkoutTemplate(...args),
    deleteWorkoutTemplate: (...args: unknown[]) => deleteWorkoutTemplate(...args),
    reorderWorkoutTemplates: (...args: unknown[]) =>
      reorderWorkoutTemplates(...args),
  };
});

vi.mock('@/features/workouts/api/workout-api', () => ({
  getActiveWorkoutSession: (...args: unknown[]) =>
    getActiveWorkoutSession(...args),
  createWorkoutSession: vi.fn(),
  getWorkoutSessionDetail: vi.fn(),
}));

vi.mock('@/features/profile/api/profile-api', () => ({
  getMe: (...args: unknown[]) => getMe(...args),
}));

vi.mock('@/features/coaching/api/coaching-api', () => ({
  getLoadRecommendation: (...args: unknown[]) => getLoadRecommendation(...args),
  listLoadRecommendationDecisions: (...args: unknown[]) =>
    listLoadRecommendationDecisions(...args),
  decideLoadRecommendation: vi.fn(),
}));

const PROGRAM_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

async function openTemplate(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  const row = await screen.findByRole('button', {
    name: new RegExp(`^${name}\\b`, 'i'),
  });
  await user.click(row);
  expect(await screen.findByRole('heading', { name })).toBeInTheDocument();
}

function renderDetail(
  detail = createProgramDetail(),
  entry = `/programs/${PROGRAM_ID}`,
) {
  getProgram.mockResolvedValue(detail);
  getActiveProgram.mockResolvedValue(null);
  getActiveWorkoutSession.mockResolvedValue(null);
  getMe.mockResolvedValue({
    data: { profile: { timezone: 'Europe/Paris' } },
  });
  getLoadRecommendation.mockResolvedValue({
    supported: false,
    workoutTemplateExerciseId: 'tex-1',
    exerciseId: 'ex-1',
  });
  listLoadRecommendationDecisions.mockResolvedValue({
    data: [],
    pagination: { nextCursor: null, hasMore: false },
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/programs/:programId" element={children} />
          <Route path="/programs/:programId/edit" element={<div>Édition</div>} />
          <Route
            path="/programs/:programId/schedule"
            element={<div>Planning</div>}
          />
          <Route path="/programs" element={<div>Liste</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return render(<ProgramDetailPage />, { wrapper });
}

describe('ProgramDetailPage', () => {
  beforeEach(() => {
    getProgram.mockReset();
    getActiveProgram.mockReset();
    activateProgram.mockReset();
    deactivateProgram.mockReset();
    archiveProgram.mockReset();
    restoreProgram.mockReset();
    createWorkoutTemplate.mockReset();
    deleteWorkoutTemplate.mockReset();
    reorderWorkoutTemplates.mockReset();
    getActiveWorkoutSession.mockReset();
    getMe.mockReset();
    getLoadRecommendation.mockReset();
    listLoadRecommendationDecisions.mockReset();
  });

  it('shows program detail and session list', async () => {
    const user = userEvent.setup();
    renderDetail();
    expect(
      await screen.findByRole('heading', { name: 'Push Pull Legs' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Push A')).toBeInTheDocument();
    expect(screen.getByText(/Séances/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Ajouter une séance/i }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: /Actions du programme/i }),
    );
    expect(
      screen.getByRole('menuitem', { name: /Modifier les informations/i }),
    ).toBeInTheDocument();
  });

  it('opens focused session editor from the list', async () => {
    const user = userEvent.setup();
    renderDetail();
    await screen.findByText('Push A');
    await openTemplate(user, 'Push A');
    expect(
      screen.getByRole('button', { name: /Ajouter un exercice/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Développé couché')).toBeInTheDocument();
  });

  it('shows inaccessible message on 404', async () => {
    const error = Object.assign(new Error('Introuvable'), { status: 404 });
    getProgram.mockRejectedValue(error);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[`/programs/${PROGRAM_ID}`]}>
          <Routes>
            <Route path="/programs/:programId" element={<ProgramDetailPage />} />
            <Route path="/programs" element={<div>Liste</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(
      await screen.findByText(/introuvable ou inaccessible/i),
    ).toBeInTheDocument();
  });

  it('archives a program and switches to restore', async () => {
    const user = userEvent.setup();
    const active = createProgramDetail();
    const archived = createProgramDetail({
      status: 'ARCHIVED',
      archivedAt: '2026-08-03T13:00:00.000Z',
      permissions: {
        canEdit: false,
        canArchive: false,
        canRestore: true,
        canActivate: false,
        canDeactivate: false,
        canEditSchedule: false,
      },
    });
    getProgram.mockResolvedValue(active);
    archiveProgram.mockResolvedValue(archived);

    renderDetail(active);
    await screen.findByRole('heading', { name: 'Push Pull Legs' });
    await user.click(screen.getByRole('button', { name: /Archiver le programme/i }));
    await user.click(screen.getByRole('button', { name: /^Archiver$/i }));

    await waitFor(() => expect(archiveProgram).toHaveBeenCalledWith(PROGRAM_ID));
    expect(await screen.findByText('Archivé')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Restaurer le programme/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Ajouter une séance/i }),
    ).not.toBeInTheDocument();
  });

  it('creates a workout template and opens the editor', async () => {
    const user = userEvent.setup();
    const initial = createProgramDetail({ workoutTemplates: [] });
    const withTemplate = createProgramDetail({
      workoutTemplates: [
        createTemplate({ id: 'wt-new', name: 'Legs', exercises: [] }),
      ],
    });
    createWorkoutTemplate.mockResolvedValue(withTemplate);

    renderDetail(initial);
    await screen.findByText(/Aucune séance/i);
    await user.click(screen.getByRole('button', { name: /Ajouter une séance/i }));
    await user.type(screen.getByLabelText(/^Nom/), 'Legs');
    await user.click(screen.getByRole('button', { name: /Créer la séance/i }));

    await waitFor(() => expect(createWorkoutTemplate).toHaveBeenCalled());
    expect(await screen.findByRole('heading', { name: 'Legs' })).toBeInTheDocument();
    expect(screen.getByText(/Aucun exercice/i)).toBeInTheDocument();
  });

  it('confirms template deletion from focused editor', async () => {
    const user = userEvent.setup();
    const initial = createProgramDetail({
      workoutTemplates: [
        createTemplate({
          exercises: [createTemplateExercise()],
        }),
      ],
    });
    deleteWorkoutTemplate.mockResolvedValue(
      createProgramDetail({ workoutTemplates: [] }),
    );

    renderDetail(initial);
    await openTemplate(user, 'Push A');
    await user.click(screen.getByRole('button', { name: /Actions pour Push A/i }));
    await user.click(screen.getByRole('menuitem', { name: /^Supprimer$/i }));
    expect(
      await screen.findByText(/exercices et séries cibles/i),
    ).toBeInTheDocument();
    const dialog = screen.getByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: /^Supprimer$/i }));
    await waitFor(() => expect(deleteWorkoutTemplate).toHaveBeenCalled());
  });

  it('reorders templates from focused editor and rolls back on error', async () => {
    const user = userEvent.setup();
    const detail = createProgramDetail({
      workoutTemplates: [
        createTemplate({ id: 't1', name: 'Séance A', position: 0, exercises: [] }),
        createTemplate({ id: 't2', name: 'Séance B', position: 1, exercises: [] }),
      ],
    });
    reorderWorkoutTemplates.mockRejectedValue(new Error('Ordre invalide'));

    renderDetail(detail);
    await openTemplate(user, 'Séance A');
    await user.click(
      screen.getByRole('button', { name: /Actions pour Séance A/i }),
    );
    await user.click(
      screen.getByRole('menuitem', { name: /Déplacer vers le bas/i }),
    );

    await waitFor(() => expect(reorderWorkoutTemplates).toHaveBeenCalled());
    expect(await screen.findByText(/Ordre invalide|réordonner/i)).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: /Retour à Push Pull Legs|Retour au programme/i }),
    );
    const sessionButtons = screen.getAllByRole('button', {
      name: /Séance (A|B)/i,
    });
    expect(sessionButtons[0]).toHaveTextContent('Séance A');
  });

  it('activates a program from the detail page', async () => {
    const user = userEvent.setup();
    const detail = createProgramDetail({
      permissions: {
        canEdit: true,
        canArchive: true,
        canRestore: false,
        canActivate: true,
        canDeactivate: false,
        canEditSchedule: true,
      },
    });
    const active = createActiveProgramSummary({ program: detail });
    getActiveProgram.mockResolvedValue(null);
    activateProgram.mockResolvedValue(active);

    renderDetail(detail);
    await screen.findByRole('heading', { name: 'Push Pull Legs' });
    expect(screen.queryByText(/Programme courant/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Utiliser ce programme/i }));

    const dateInput = screen.getByLabelText(/Date de début/i);
    await user.clear(dateInput);
    await user.type(dateInput, '2026-08-03');
    await user.click(screen.getByRole('button', { name: /^Activer$/i }));

    await waitFor(() =>
      expect(activateProgram).toHaveBeenCalledWith(PROGRAM_ID, {
        startedOn: '2026-08-03',
        replaceCurrentProgram: false,
      }),
    );
    expect(
      await screen.findByText(/maintenant ton programme courant/i),
    ).toBeInTheDocument();
  });

  it('deactivates current program from the overflow menu', async () => {
    const user = userEvent.setup();
    const detail = createProgramDetail({
      isCurrent: true,
      permissions: {
        canEdit: true,
        canArchive: false,
        canRestore: false,
        canActivate: false,
        canDeactivate: true,
        canEditSchedule: true,
      },
    });
    deactivateProgram.mockResolvedValue(null);

    renderDetail(detail);
    expect(await screen.findByText('Actif')).toBeInTheDocument();
    expect(screen.queryByText(/Programme courant/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^Désactiver$/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Voir le planning/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Actions du programme/i }));
    await user.click(screen.getByRole('menuitem', { name: /^Désactiver$/i }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: /^Désactiver$/i }));

    await waitFor(() => expect(deactivateProgram).toHaveBeenCalledWith(PROGRAM_ID));
    expect(
      await screen.findByText(/Programme courant désactivé/i),
    ).toBeInTheDocument();
  });

  it('keeps archived program read-only', async () => {
    const user = userEvent.setup();
    renderDetail(
      createProgramDetail({
        status: 'ARCHIVED',
        archivedAt: '2026-08-03T13:00:00.000Z',
        permissions: {
          canEdit: false,
          canArchive: false,
          canRestore: true,
          canActivate: false,
          canDeactivate: false,
          canEditSchedule: false,
        },
      }),
    );
    expect(await screen.findByText('Archivé')).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: /Actions du programme/i }),
    );
    expect(
      screen.queryByRole('menuitem', { name: /Modifier les informations/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Restaurer le programme/i }),
    ).toBeInTheDocument();
  });
});
