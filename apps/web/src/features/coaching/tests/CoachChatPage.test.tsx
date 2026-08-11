import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoachChatPage } from '../pages/CoachChatPage';

const {
  getMe,
  listAiCoachConversations,
  getAiCoachConversation,
  createAiCoachConversation,
  sendAiCoachMessage,
  acceptAiCoachProposal,
  dismissAiCoachProposal,
} = vi.hoisted(() => ({
  getMe: vi.fn(),
  listAiCoachConversations: vi.fn(),
  getAiCoachConversation: vi.fn(),
  createAiCoachConversation: vi.fn(),
  sendAiCoachMessage: vi.fn(),
  acceptAiCoachProposal: vi.fn(),
  dismissAiCoachProposal: vi.fn(),
}));

vi.mock('@/features/profile/api/profile-api', () => ({
  getMe: (...args: unknown[]) => getMe(...args),
}));

vi.mock('../api/coaching-api', () => ({
  listAiCoachConversations: (...args: unknown[]) =>
    listAiCoachConversations(...args),
  getAiCoachConversation: (...args: unknown[]) =>
    getAiCoachConversation(...args),
  createAiCoachConversation: (...args: unknown[]) =>
    createAiCoachConversation(...args),
  sendAiCoachMessage: (...args: unknown[]) => sendAiCoachMessage(...args),
  archiveAiCoachConversation: vi.fn(),
  acceptAiCoachProposal: (...args: unknown[]) => acceptAiCoachProposal(...args),
  dismissAiCoachProposal: (...args: unknown[]) =>
    dismissAiCoachProposal(...args),
}));

describe('CoachChatPage (5.6)', () => {
  beforeEach(() => {
    getMe.mockReset();
    listAiCoachConversations.mockReset();
    getAiCoachConversation.mockReset();
    createAiCoachConversation.mockReset();
    sendAiCoachMessage.mockReset();
    acceptAiCoachProposal.mockReset();
    dismissAiCoachProposal.mockReset();
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    });
    getMe.mockResolvedValue({
      data: {
        id: 'u1',
        email: 'a@test.local',
        status: 'ACTIVE',
        role: 'USER',
        profile: {
          displayName: 'A',
          timezone: 'Europe/Paris',
          weightUnit: 'KG',
          distanceUnit: 'KM',
          primaryGoal: 'STRENGTH',
          experienceLevel: 'INTERMEDIATE',
          effortTrackingMode: 'NONE',
          heightCm: null,
          currentWeightKg: null,
          weeklyTrainingTarget: null,
          defaultWorkoutDurationMinutes: null,
        },
        ai: { available: true },
      },
    });
    listAiCoachConversations.mockResolvedValue({
      data: [],
      pagination: { nextCursor: null, hasMore: false },
    });
  });

  it('affiche nouvelle conversation et envoie un message', async () => {
    const user = userEvent.setup();
    createAiCoachConversation.mockResolvedValue({
      id: 'conv-1',
      title: null,
      contextExercise: null,
      archivedAt: null,
      createdAt: '2026-08-10T10:00:00.000Z',
      updatedAt: '2026-08-10T10:00:00.000Z',
      messages: [],
      pagination: { nextCursor: null, hasMore: false },
    });
    sendAiCoachMessage.mockResolvedValue({
      userMessage: {
        id: 'm1',
        role: 'USER',
        content: 'À quoi sert le RIR ?',
        references: [],
        suggestedFollowUps: [],
        proposal: null,
        createdAt: '2026-08-10T10:01:00.000Z',
      },
      assistantMessage: {
        id: 'm2',
        role: 'ASSISTANT',
        content: 'Le RIR estime les répétitions en réserve.',
        references: [],
        suggestedFollowUps: [],
        proposal: null,
        createdAt: '2026-08-10T10:01:01.000Z',
      },
    });
    getAiCoachConversation.mockImplementation(async () => ({
      id: 'conv-1',
      title: 'À quoi sert le RIR ?',
      contextExercise: null,
      archivedAt: null,
      createdAt: '2026-08-10T10:00:00.000Z',
      updatedAt: '2026-08-10T10:01:01.000Z',
      messages: sendAiCoachMessage.mock.calls.length
        ? [
            {
              id: 'm1',
              role: 'USER',
              content: 'À quoi sert le RIR ?',
              references: [],
              suggestedFollowUps: [],
              proposal: null,
              createdAt: '2026-08-10T10:01:00.000Z',
            },
            {
              id: 'm2',
              role: 'ASSISTANT',
              content: 'Le RIR estime les répétitions en réserve.',
              references: [],
              suggestedFollowUps: [],
              proposal: null,
              createdAt: '2026-08-10T10:01:01.000Z',
            },
          ]
        : [],
      pagination: { nextCursor: null, hasMore: false },
    }));

    render(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: {
              queries: { retry: false },
              mutations: { retry: false },
            },
          })
        }
      >
        <MemoryRouter initialEntries={['/coach/chat']}>
          <Routes>
            <Route path="/coach/chat" element={<CoachChatPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByText(/Choisis une suggestion/i);
    await user.type(
      screen.getByLabelText(/Message pour le Coach/i),
      'À quoi sert le RIR ?',
    );
    await user.click(screen.getByRole('button', { name: /Envoyer/i }));

    await waitFor(() => {
      expect(createAiCoachConversation).toHaveBeenCalled();
      expect(sendAiCoachMessage).toHaveBeenCalled();
    });
    await screen.findByText(/Le RIR estime/i);
  });

  it('masque le chat si IA désactivée', async () => {
    getMe.mockResolvedValue({
      data: {
        id: 'u1',
        email: 'a@test.local',
        status: 'ACTIVE',
        role: 'USER',
        profile: {
          displayName: 'A',
          timezone: 'Europe/Paris',
          weightUnit: 'KG',
          distanceUnit: 'KM',
          primaryGoal: 'STRENGTH',
          experienceLevel: 'INTERMEDIATE',
          effortTrackingMode: 'NONE',
          heightCm: null,
          currentWeightKg: null,
          weeklyTrainingTarget: null,
          defaultWorkoutDurationMinutes: null,
        },
        ai: { available: false },
      },
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/coach/chat']}>
          <Routes>
            <Route path="/coach/chat" element={<CoachChatPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByText(/Indisponible sur cet environnement/i);
    expect(screen.getByRole('link', { name: /Retour au Coach/i })).toBeInTheDocument();
  });

  it('traduit le rate limit en message humain', async () => {
    const user = userEvent.setup();
    createAiCoachConversation.mockResolvedValue({
      id: 'conv-1',
      title: null,
      contextExercise: null,
      archivedAt: null,
      createdAt: '2026-08-10T10:00:00.000Z',
      updatedAt: '2026-08-10T10:00:00.000Z',
      messages: [],
      pagination: { nextCursor: null, hasMore: false },
    });
    const rateError = Object.assign(new Error('rate'), {
      code: 'AI_COACH_RATE_LIMITED',
      status: 429,
    });
    sendAiCoachMessage.mockRejectedValue(rateError);
    getAiCoachConversation.mockResolvedValue({
      id: 'conv-1',
      title: null,
      contextExercise: null,
      archivedAt: null,
      createdAt: '2026-08-10T10:00:00.000Z',
      updatedAt: '2026-08-10T10:00:00.000Z',
      messages: [],
      pagination: { nextCursor: null, hasMore: false },
    });

    render(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: {
              queries: { retry: false },
              mutations: { retry: false },
            },
          })
        }
      >
        <MemoryRouter initialEntries={['/coach/chat']}>
          <Routes>
            <Route path="/coach/chat" element={<CoachChatPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByText(/Choisis une suggestion/i);
    await user.type(
      screen.getByLabelText(/Message pour le Coach/i),
      'Question test',
    );
    await user.click(screen.getByRole('button', { name: /Envoyer/i }));

    expect(
      await screen.findByText(/Trop de demandes en peu de temps/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/429/i)).not.toBeInTheDocument();
  });

  it('affiche une proposition de programme et permet de la refuser (jalon 8)', async () => {
    const user = userEvent.setup();
    const proposal = {
      id: 'proposal-1',
      kind: 'PROGRAM' as const,
      status: 'PENDING' as const,
      preview: {
        kind: 'PROGRAM' as const,
        program: {
          name: 'Programme Force 3x/semaine',
          description: null,
          goal: 'STRENGTH' as const,
          workouts: [
            {
              name: 'Séance A',
              estimatedDurationMinutes: 60,
              exercises: [],
            },
          ],
          schedule: null,
        },
      },
      createdProgramId: null,
      createdWorkoutTemplateId: null,
      createdAt: '2026-08-11T10:02:00.000Z',
      acceptedAt: null,
      dismissedAt: null,
    };
    getAiCoachConversation.mockResolvedValue({
      id: 'conv-1',
      title: 'Proposition',
      contextExercise: null,
      archivedAt: null,
      createdAt: '2026-08-11T10:00:00.000Z',
      updatedAt: '2026-08-11T10:02:00.000Z',
      messages: [
        {
          id: 'm1',
          role: 'USER',
          content: 'Propose-moi un programme force.',
          references: [],
          suggestedFollowUps: [],
          proposal: null,
          createdAt: '2026-08-11T10:01:00.000Z',
        },
        {
          id: 'm2',
          role: 'ASSISTANT',
          content: 'Voici une proposition de programme.',
          references: [],
          suggestedFollowUps: [],
          proposal,
          createdAt: '2026-08-11T10:02:00.000Z',
        },
      ],
      pagination: { nextCursor: null, hasMore: false },
    });
    dismissAiCoachProposal.mockResolvedValue({
      proposal: { ...proposal, status: 'DISMISSED', dismissedAt: '2026-08-11T10:03:00.000Z' },
    });

    render(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: {
              queries: { retry: false },
              mutations: { retry: false },
            },
          })
        }
      >
        <MemoryRouter initialEntries={['/coach/chat?c=conv-1']}>
          <Routes>
            <Route path="/coach/chat" element={<CoachChatPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByText(/Programme Force 3x\/semaine/i);
    expect(
      screen.getByRole('article', { name: /Proposition de programme/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/"kind":"PROGRAM"/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Refuser/i }));

    await waitFor(() => {
      expect(dismissAiCoachProposal).toHaveBeenCalledWith('proposal-1');
    });
  });
});
