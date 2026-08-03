import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProgramScheduleEditPage } from '../pages/ProgramScheduleEditPage';
import {
  createProgramDetail,
  createProgramSchedule,
  createTemplate,
} from './fixtures';

const getProgram = vi.fn();
const getProgramSchedule = vi.fn();
const replaceProgramSchedule = vi.fn();

vi.mock('../api/program-api', async () => {
  const actual = await vi.importActual<typeof import('../api/program-api')>(
    '../api/program-api',
  );
  return {
    ...actual,
    getProgram: (...args: unknown[]) => getProgram(...args),
    getProgramSchedule: (...args: unknown[]) => getProgramSchedule(...args),
    replaceProgramSchedule: (...args: unknown[]) =>
      replaceProgramSchedule(...args),
  };
});

const PROGRAM_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

function renderScheduleEditor(
  detail = createProgramDetail({
    workoutTemplates: [
      createTemplate({ id: 'wt-1', name: 'Push A' }),
      createTemplate({ id: 'wt-2', name: 'Pull B', position: 1 }),
    ],
  }),
  schedule = createProgramSchedule(),
) {
  getProgram.mockResolvedValue(detail);
  getProgramSchedule.mockResolvedValue(schedule);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/programs/${PROGRAM_ID}/schedule`]}>
        <Routes>
          <Route path="/programs/:programId/schedule" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return render(<ProgramScheduleEditPage />, { wrapper });
}

describe('ProgramScheduleEditPage', () => {
  beforeEach(() => {
    getProgram.mockReset();
    getProgramSchedule.mockReset();
    replaceProgramSchedule.mockReset();
  });

  it('adds, reorders and saves schedule entries', async () => {
    const user = userEvent.setup();
    const savedSchedule = createProgramSchedule({
      entries: [
        {
          id: 'saved-1',
          weekday: 'MONDAY',
          position: 0,
          workoutTemplate: {
            id: 'wt-1',
            name: 'Push A',
            estimatedDurationMinutes: 60,
            exerciseCount: 1,
          },
        },
      ],
    });
    replaceProgramSchedule.mockResolvedValue(savedSchedule);

    renderScheduleEditor();
    await screen.findByRole('heading', { name: /Planning hebdomadaire/i });

    const mondaySection = screen.getByRole('heading', { name: 'Lundi' }).closest('section')!;
    const mondaySelect = within(mondaySection).getByRole('combobox');
    await user.selectOptions(mondaySelect, 'wt-1');
    expect(within(mondaySection).getByRole('listitem')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Enregistrer/i }));

    await waitFor(() =>
      expect(replaceProgramSchedule).toHaveBeenCalledWith(PROGRAM_ID, {
        entries: [
          {
            workoutTemplateId: 'wt-1',
            weekday: 'MONDAY',
            position: 0,
          },
        ],
      }),
    );
    expect(await screen.findByText(/Planning enregistré/i)).toBeInTheDocument();
  });

  it('restores draft on cancel', async () => {
    const user = userEvent.setup();
    renderScheduleEditor();
    await screen.findByRole('heading', { name: /Planning hebdomadaire/i });

    const mondaySection = screen.getByRole('heading', { name: 'Lundi' }).closest('section')!;
    const mondaySelect = within(mondaySection).getByRole('combobox');
    await user.selectOptions(mondaySelect, 'wt-2');
    expect(within(mondaySection).getByRole('listitem')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Annuler/i }));
    expect(within(mondaySection).queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('shows empty templates message', async () => {
    renderScheduleEditor(createProgramDetail({ workoutTemplates: [] }));
    expect(
      await screen.findByText(/n’a aucun modèle de séance/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Configurer les séances/i }),
    ).toHaveAttribute('href', `/programs/${PROGRAM_ID}`);
  });
});
