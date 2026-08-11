import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProgramsPage } from '../pages/ProgramsPage';
import { createProgramListItem } from './fixtures';

const listPrograms = vi.fn();

vi.mock('../api/program-api', async () => {
  const actual = await vi.importActual<typeof import('../api/program-api')>(
    '../api/program-api',
  );
  return {
    ...actual,
    listPrograms: (...args: unknown[]) => listPrograms(...args),
  };
});

function renderList(entry = '/programs') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/programs" element={children} />
          <Route path="/programs/new" element={<div>Création</div>} />
          <Route path="/programs/:programId" element={<div>Détail</div>} />
          <Route path="/programs/:programId/edit" element={<div>Édition</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return render(<ProgramsPage />, { wrapper });
}

describe('ProgramsPage', () => {
  beforeEach(() => {
    listPrograms.mockReset();
  });

  it('lists programs and navigates to create', async () => {
    const user = userEvent.setup();
    listPrograms.mockResolvedValue({
      data: [createProgramListItem()],
      pagination: { nextCursor: null, hasMore: false },
    });

    renderList();
    expect(await screen.findByText('Push Pull Legs')).toBeInTheDocument();
    expect(screen.getByText(/2 séances/i)).toBeInTheDocument();
    expect(screen.getByText(/Hypertrophie/i)).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /Créer un programme/i }));
    expect(await screen.findByText('Création')).toBeInTheDocument();
  });

  it('opens detail on row tap and exposes secondary menu', async () => {
    const user = userEvent.setup();
    listPrograms.mockResolvedValue({
      data: [
        createProgramListItem({
          isCurrent: true,
          name: 'Programme actif',
        }),
      ],
      pagination: { nextCursor: null, hasMore: false },
    });

    renderList();
    expect(await screen.findByText('Actif')).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: /Actions pour Programme actif/i }),
    );
    expect(screen.getByRole('menuitem', { name: /Modifier/i })).toBeInTheDocument();
    await user.click(
      screen.getByRole('link', { name: /Ouvrir le programme Programme actif/i }),
    );
    expect(await screen.findByText('Détail')).toBeInTheDocument();
  });

  it('paginates with Charger plus', async () => {
    const user = userEvent.setup();
    listPrograms
      .mockResolvedValueOnce({
        data: [createProgramListItem({ id: 'p1', name: 'Prog 1' })],
        pagination: { nextCursor: 'cursor-2', hasMore: true },
      })
      .mockResolvedValueOnce({
        data: [createProgramListItem({ id: 'p2', name: 'Prog 2' })],
        pagination: { nextCursor: null, hasMore: false },
      });

    renderList();
    expect(await screen.findByText('Prog 1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Charger plus/i }));
    expect(await screen.findByText('Prog 2')).toBeInTheDocument();
    expect(listPrograms).toHaveBeenCalledTimes(2);
  });

  it('syncs includeArchived with URL and shows empty state', async () => {
    const user = userEvent.setup();
    listPrograms.mockResolvedValue({
      data: [],
      pagination: { nextCursor: null, hasMore: false },
    });

    renderList('/programs');
    expect(
      await screen.findByText(/Tu n’as encore créé aucun programme/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Créer mon premier programme/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByLabelText(/Inclure les programmes archivés/i));
    await waitFor(() =>
      expect(listPrograms).toHaveBeenLastCalledWith(
        expect.objectContaining({ includeArchived: true }),
      ),
    );
  });
});
