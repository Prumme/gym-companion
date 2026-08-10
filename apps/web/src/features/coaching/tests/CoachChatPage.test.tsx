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
} = vi.hoisted(() => ({
  getMe: vi.fn(),
  listAiCoachConversations: vi.fn(),
  getAiCoachConversation: vi.fn(),
  createAiCoachConversation: vi.fn(),
  sendAiCoachMessage: vi.fn(),
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
}));

describe('CoachChatPage (5.6)', () => {
  beforeEach(() => {
    getMe.mockReset();
    listAiCoachConversations.mockReset();
    getAiCoachConversation.mockReset();
    createAiCoachConversation.mockReset();
    sendAiCoachMessage.mockReset();
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
        createdAt: '2026-08-10T10:01:00.000Z',
      },
      assistantMessage: {
        id: 'm2',
        role: 'ASSISTANT',
        content: 'Le RIR estime les répétitions en réserve.',
        references: [],
        suggestedFollowUps: [],
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
              createdAt: '2026-08-10T10:01:00.000Z',
            },
            {
              id: 'm2',
              role: 'ASSISTANT',
              content: 'Le RIR estime les répétitions en réserve.',
              references: [],
              suggestedFollowUps: [],
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

    await screen.findByText(/Nouvelle conversation/i);
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
    await screen.findByText(/Les explications IA ne sont pas activées/i);
  });
});
