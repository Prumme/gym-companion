import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CreateProgramPage } from '../pages/CreateProgramPage';
import { createProgramDetail } from './fixtures';

const createProgram = vi.fn();

vi.mock('../api/program-api', async () => {
  const actual = await vi.importActual<typeof import('../api/program-api')>(
    '../api/program-api',
  );
  return {
    ...actual,
    createProgram: (...args: unknown[]) => createProgram(...args),
  };
});

function renderCreate() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/programs/new']}>
        <Routes>
          <Route path="/programs/new" element={children} />
          <Route path="/programs/:programId" element={<div>Détail programme</div>} />
          <Route path="/programs" element={<div>Liste</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return render(<CreateProgramPage />, { wrapper });
}

describe('CreateProgramPage', () => {
  beforeEach(() => {
    createProgram.mockReset();
  });

  it('creates a program and navigates to detail', async () => {
    const user = userEvent.setup();
    createProgram.mockResolvedValue(
      createProgramDetail({ id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' }),
    );

    renderCreate();
    await user.type(screen.getByLabelText(/^Nom/), 'Mon programme');
    await user.click(screen.getByRole('button', { name: /Créer le programme/i }));

    await waitFor(() => expect(createProgram).toHaveBeenCalledTimes(1));
    expect(createProgram.mock.calls[0]?.[0]).toMatchObject({
      name: 'Mon programme',
      goal: 'GENERAL_FITNESS',
    });
    expect(await screen.findByText('Détail programme')).toBeInTheDocument();
  });

  it('keeps values and shows error on failure', async () => {
    const user = userEvent.setup();
    createProgram.mockRejectedValue(new Error('Création refusée'));

    renderCreate();
    await user.type(screen.getByLabelText(/^Nom/), 'Échec');
    await user.click(screen.getByRole('button', { name: /Créer le programme/i }));

    expect(await screen.findByText('Création refusée')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Nom/)).toHaveValue('Échec');
  });
});
