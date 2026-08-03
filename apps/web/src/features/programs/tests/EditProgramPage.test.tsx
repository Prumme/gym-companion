import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EditProgramPage } from '../pages/EditProgramPage';
import { createProgramDetail } from './fixtures';

const getProgram = vi.fn();
const updateProgram = vi.fn();

vi.mock('../api/program-api', async () => {
  const actual = await vi.importActual<typeof import('../api/program-api')>(
    '../api/program-api',
  );
  return {
    ...actual,
    getProgram: (...args: unknown[]) => getProgram(...args),
    updateProgram: (...args: unknown[]) => updateProgram(...args),
  };
});

const PROGRAM_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

function renderEdit(detail = createProgramDetail()) {
  getProgram.mockResolvedValue(detail);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/programs/${PROGRAM_ID}/edit`]}>
        <Routes>
          <Route path="/programs/:programId/edit" element={children} />
          <Route path="/programs/:programId" element={<div>Détail</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return render(<EditProgramPage />, { wrapper });
}

describe('EditProgramPage', () => {
  beforeEach(() => {
    getProgram.mockReset();
    updateProgram.mockReset();
  });

  it('prefills and updates general info', async () => {
    const user = userEvent.setup();
    updateProgram.mockResolvedValue(
      createProgramDetail({ name: 'Push Pull Legs V2' }),
    );

    renderEdit();
    const nameInput = await screen.findByLabelText(/^Nom/);
    expect(nameInput).toHaveValue('Push Pull Legs');
    await user.clear(nameInput);
    await user.type(nameInput, 'Push Pull Legs V2');
    await user.click(screen.getByRole('button', { name: /Enregistrer/i }));

    await waitFor(() => expect(updateProgram).toHaveBeenCalled());
    expect(await screen.findByText('Détail')).toBeInTheDocument();
  });

  it('blocks edit when archived', async () => {
    renderEdit(
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
    expect(
      await screen.findByText(/archivé ou non modifiable/i),
    ).toBeInTheDocument();
  });
});
