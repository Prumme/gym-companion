import type { AiCoachProposalSummary } from '@gym-companion/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoachProposalCard } from '../components/CoachProposalCard';

const { acceptAiCoachProposal, dismissAiCoachProposal, listPrograms } =
  vi.hoisted(() => ({
    acceptAiCoachProposal: vi.fn(),
    dismissAiCoachProposal: vi.fn(),
    listPrograms: vi.fn(),
  }));

vi.mock('../api/coaching-api', () => ({
  acceptAiCoachProposal: (...args: unknown[]) =>
    acceptAiCoachProposal(...args),
  dismissAiCoachProposal: (...args: unknown[]) =>
    dismissAiCoachProposal(...args),
}));

vi.mock('@/features/programs/api/program-api', () => ({
  listPrograms: (...args: unknown[]) => listPrograms(...args),
}));

function renderCard(proposal: AiCoachProposalSummary) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CoachProposalCard proposal={proposal} conversationId="conv-1" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const workoutProposal: AiCoachProposalSummary = {
  id: 'proposal-workout-1',
  kind: 'WORKOUT',
  status: 'PENDING',
  preview: {
    kind: 'WORKOUT',
    workout: {
      name: 'Push Force',
      estimatedDurationMinutes: 45,
      exercises: [
        {
          exerciseId: 'ex-1',
          exerciseName: 'Développé couché',
          measurementType: 'WEIGHT_REPS',
          equipmentTypeId: 'eq-1',
          equipmentName: 'Barre',
          notes: null,
          sets: [
            {
              setType: 'WORKING',
              targetRepMin: 6,
              targetRepMax: 8,
              targetDurationSeconds: null,
              targetDistanceMeters: null,
              targetWeightKg: 80,
              targetIntensityPercent: null,
              targetRir: 2,
              targetRpe: null,
              restSeconds: 120,
            },
          ],
        },
      ],
    },
  },
  createdProgramId: null,
  createdWorkoutTemplateId: null,
  createdAt: '2026-08-11T10:00:00.000Z',
  acceptedAt: null,
  dismissedAt: null,
};

describe('CoachProposalCard (jalon 8)', () => {
  beforeEach(() => {
    acceptAiCoachProposal.mockReset();
    dismissAiCoachProposal.mockReset();
    listPrograms.mockReset();
    listPrograms.mockResolvedValue({
      data: [
        {
          id: 'program-1',
          name: 'Force 3x/semaine',
          description: null,
          goal: 'STRENGTH',
          status: 'ACTIVE',
          workoutTemplateCount: 2,
          isCurrent: true,
          archivedAt: null,
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
          permissions: {
            canEdit: true,
            canArchive: true,
            canRestore: false,
            canActivate: false,
            canDeactivate: true,
            canEditSchedule: true,
          },
        },
      ],
      pagination: { nextCursor: null, hasMore: false },
    });
  });

  it('n’affiche jamais le JSON brut de la proposition', () => {
    renderCard(workoutProposal);
    expect(screen.getByText('Push Force')).toBeInTheDocument();
    expect(screen.queryByText(/"kind":"WORKOUT"/)).not.toBeInTheDocument();
    expect(screen.queryByText(/exerciseId/)).not.toBeInTheDocument();
  });

  it('affiche le détail de la séance dans une fiche dédiée', async () => {
    const user = userEvent.setup();
    renderCard(workoutProposal);
    await user.click(screen.getByRole('button', { name: /Voir le détail/i }));
    expect(await screen.findByText('Développé couché')).toBeInTheDocument();
    expect(screen.getByText(/6–8 reps/)).toBeInTheDocument();
  });

  it('demande un programme cible avant d’accepter une proposition de séance', async () => {
    const user = userEvent.setup();
    acceptAiCoachProposal.mockResolvedValue({
      proposal: { ...workoutProposal, status: 'ACCEPTED' },
    });
    renderCard(workoutProposal);

    await user.click(screen.getByRole('button', { name: /Accepter/i }));
    expect(
      await screen.findByText(/Ajouter cette séance à…/i),
    ).toBeInTheDocument();
    expect(acceptAiCoachProposal).not.toHaveBeenCalled();

    await screen.findByRole('option', { name: 'Force 3x/semaine' });
    await user.selectOptions(
      screen.getByLabelText('Programme cible'),
      'program-1',
    );
    await user.click(
      screen.getByRole('button', { name: /Ajouter la séance/i }),
    );

    await waitFor(() => {
      expect(acceptAiCoachProposal).toHaveBeenCalledWith('proposal-workout-1', {
        programId: 'program-1',
      });
    });
  });

  const programProposal: AiCoachProposalSummary = {
    id: 'proposal-program-1',
    kind: 'PROGRAM',
    status: 'PENDING',
    preview: {
      kind: 'PROGRAM',
      program: {
        name: 'Force complet',
        description: null,
        goal: 'STRENGTH',
        workouts: [
          { name: 'Séance A', estimatedDurationMinutes: 50, exercises: [] },
        ],
        schedule: null,
      },
    },
    createdProgramId: null,
    createdWorkoutTemplateId: null,
    createdAt: '2026-08-11T10:00:00.000Z',
    acceptedAt: null,
    dismissedAt: null,
  };

  it('accepte directement une proposition de programme (sans sélection de programme)', async () => {
    const user = userEvent.setup();
    acceptAiCoachProposal.mockResolvedValue({
      proposal: { ...programProposal, status: 'ACCEPTED' },
    });
    renderCard(programProposal);

    await user.click(screen.getByRole('button', { name: /Accepter/i }));

    await waitFor(() => {
      expect(acceptAiCoachProposal).toHaveBeenCalledWith(
        'proposal-program-1',
        {},
      );
    });
    expect(
      screen.queryByText(/Ajouter cette séance à…/i),
    ).not.toBeInTheDocument();
  });

  it('affiche un message clair pour une proposition devenue invalide', () => {
    renderCard({ ...workoutProposal, status: 'INVALID' });
    expect(
      screen.getByText(/n’est plus valide/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Accepter/i }),
    ).not.toBeInTheDocument();
  });
});
