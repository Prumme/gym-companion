import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProgramDetailPage } from '../pages/ProgramDetailPage';
import {
  createProgramDetail,
  createTemplate,
  createTemplateExercise,
} from './fixtures';

const getProgram = vi.fn();
const archiveProgram = vi.fn();
const restoreProgram = vi.fn();
const createWorkoutTemplate = vi.fn();
const deleteWorkoutTemplate = vi.fn();
const reorderWorkoutTemplates = vi.fn();

vi.mock('../api/program-api', async () => {
  const actual = await vi.importActual<typeof import('../api/program-api')>(
    '../api/program-api',
  );
  return {
    ...actual,
    getProgram: (...args: unknown[]) => getProgram(...args),
    archiveProgram: (...args: unknown[]) => archiveProgram(...args),
    restoreProgram: (...args: unknown[]) => restoreProgram(...args),
    createWorkoutTemplate: (...args: unknown[]) => createWorkoutTemplate(...args),
    deleteWorkoutTemplate: (...args: unknown[]) => deleteWorkoutTemplate(...args),
    reorderWorkoutTemplates: (...args: unknown[]) =>
      reorderWorkoutTemplates(...args),
  };
});

const PROGRAM_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

function renderDetail(detail = createProgramDetail()) {
  getProgram.mockResolvedValue(detail);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/programs/${PROGRAM_ID}`]}>
        <Routes>
          <Route path="/programs/:programId" element={children} />
          <Route path="/programs/:programId/edit" element={<div>Édition</div>} />
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
    archiveProgram.mockReset();
    restoreProgram.mockReset();
    createWorkoutTemplate.mockReset();
    deleteWorkoutTemplate.mockReset();
    reorderWorkoutTemplates.mockReset();
  });

  it('shows program detail and templates', async () => {
    renderDetail();
    expect(await screen.findByRole('heading', { name: 'Push Pull Legs' })).toBeInTheDocument();
    expect(screen.getByText('Push A')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Modifier les informations/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Ajouter une séance/i }),
    ).toBeInTheDocument();
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

  it('creates a workout template', async () => {
    const user = userEvent.setup();
    const initial = createProgramDetail({ workoutTemplates: [] });
    const withTemplate = createProgramDetail({
      workoutTemplates: [createTemplate({ id: 'wt-new', name: 'Legs' })],
    });
    createWorkoutTemplate.mockResolvedValue(withTemplate);

    renderDetail(initial);
    await screen.findByText(/Aucune séance/i);
    await user.click(screen.getByRole('button', { name: /Ajouter une séance/i }));
    await user.type(screen.getByLabelText(/^Nom/), 'Legs');
    await user.click(screen.getByRole('button', { name: /Créer la séance/i }));

    await waitFor(() => expect(createWorkoutTemplate).toHaveBeenCalled());
    expect(await screen.findByText('Legs')).toBeInTheDocument();
  });

  it('confirms template deletion', async () => {
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
    await screen.findByText('Push A');
    await user.click(screen.getByRole('button', { name: /Actions pour Push A/i }));
    await user.click(screen.getByRole('button', { name: /^Supprimer$/i }));
    expect(
      await screen.findByText(/exercices et séries cibles/i),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Supprimer$/i }));
    await waitFor(() => expect(deleteWorkoutTemplate).toHaveBeenCalled());
  });

  it('reorders templates optimistically and rolls back on error', async () => {
    const user = userEvent.setup();
    const detail = createProgramDetail({
      workoutTemplates: [
        createTemplate({ id: 't1', name: 'Séance A', position: 0, exercises: [] }),
        createTemplate({ id: 't2', name: 'Séance B', position: 1, exercises: [] }),
      ],
    });
    reorderWorkoutTemplates.mockRejectedValue(new Error('Ordre invalide'));

    renderDetail(detail);
    await screen.findByText('Séance A');
    await user.click(screen.getByRole('button', { name: /Descendre la séance Séance A/i }));

    await waitFor(() => expect(reorderWorkoutTemplates).toHaveBeenCalled());
    expect(await screen.findByText(/Ordre invalide|réordonner/i)).toBeInTheDocument();
    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings[0]).toHaveTextContent('Séance A');
  });

  it('keeps archived program read-only', async () => {
    renderDetail(
      createProgramDetail({
        status: 'ARCHIVED',
        archivedAt: '2026-08-03T13:00:00.000Z',
        permissions: {
          canEdit: false,
          canArchive: false,
          canRestore: true,
        },
      }),
    );
    expect(await screen.findByText('Archivé')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Modifier les informations/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Restaurer le programme/i }),
    ).toBeInTheDocument();
  });
});
