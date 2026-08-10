import type {
  ExerciseCoachExplanationResponse,
  ExerciseCoachSummary,
} from '@gym-companion/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExerciseCoachAiExplanation } from '../components/ExerciseCoachAiExplanation';

const { generateExerciseCoachExplanation } = vi.hoisted(() => ({
  generateExerciseCoachExplanation: vi.fn(),
}));

vi.mock('../api/coaching-api', () => ({
  generateExerciseCoachExplanation: (...args: unknown[]) =>
    generateExerciseCoachExplanation(...args),
}));

function summary(
  overrides: Partial<ExerciseCoachSummary> = {},
): ExerciseCoachSummary {
  return {
    exercise: {
      id: 'ex-1',
      name: 'Squat',
      archived: false,
      measurementType: 'WEIGHT_REPS',
    },
    supported: true,
    status: 'WATCH',
    headline: {
      title: 'Progression à surveiller',
      description: 'desc',
    },
    loadRecommendation: {
      action: 'HOLD',
      currentWeightKg: 80,
      suggestedWeightKg: 80,
      reasons: [],
      workoutCount: 3,
      actionable: true,
      workoutTemplateExerciseId: 'wte-1',
      programId: 'prog-1',
    },
    plateau: {
      status: 'WATCH',
      reasons: ['LOAD_NOT_INCREASING'],
      analyzedWorkoutCount: 3,
      firstWorkoutDate: '2026-08-01',
      latestWorkoutDate: '2026-08-03',
    },
    progress: {
      maxWeightKg: { first: 80, latest: 80, change: 0 },
      maxReps: { first: 8, latest: 8, change: 0 },
      workoutCount: 3,
    },
    strength: null,
    recentDecision: null,
    actions: [],
    notices: [],
    generatedFrom: { latestWorkoutDate: '2026-08-03', workoutCount: 3 },
    coachSummaryFingerprint: 'fp-a',
    ...overrides,
  };
}

function explanation(
  fingerprint = 'fp-a',
): ExerciseCoachExplanationResponse {
  return {
    explanation: {
      title: 'Progression à surveiller',
      summary: 'Ta charge est restée à 80 kg.',
      keyPoints: ['Conserver 80 kg.', 'Peu d’évolution du 1RM estimé.'],
      caution: null,
    },
    meta: {
      schemaVersion: 'AI_COACH_EXPLANATION_V1',
      promptVersion: 'AI_COACH_PROMPT_V1',
      focus: 'GENERAL',
      coachSummaryFingerprint: fingerprint,
      generatedAt: '2026-08-03T12:00:00.000Z',
    },
  };
}

describe('ExerciseCoachAiExplanation (5.5)', () => {
  beforeEach(() => {
    generateExerciseCoachExplanation.mockReset();
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    });
  });

  it('masque le bouton si IA désactivée', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ExerciseCoachAiExplanation
          exerciseId="ex-1"
          summary={summary()}
          aiAvailable={false}
        />
      </QueryClientProvider>,
    );
    expect(screen.getByText(/Explications IA non activées/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Obtenir une explication/i }),
    ).not.toBeInTheDocument();
  });

  it('génère à la demande et affiche le résultat', async () => {
    const user = userEvent.setup();
    generateExerciseCoachExplanation.mockResolvedValue(explanation());
    render(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { mutations: { retry: false } },
          })
        }
      >
        <ExerciseCoachAiExplanation
          exerciseId="ex-1"
          summary={summary()}
          aiAvailable
        />
      </QueryClientProvider>,
    );

    expect(generateExerciseCoachExplanation).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole('button', { name: /Obtenir une explication/i }),
    );
    await screen.findByText('Progression à surveiller');
    expect(screen.getByText(/Ta charge est restée à 80 kg/i)).toBeInTheDocument();
    expect(screen.getByText(/Conserver 80 kg/i)).toBeInTheDocument();
    expect(generateExerciseCoachExplanation).toHaveBeenCalledTimes(1);
  });

  it('signale offline', () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false,
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ExerciseCoachAiExplanation
          exerciseId="ex-1"
          summary={summary()}
          aiAvailable
        />
      </QueryClientProvider>,
    );
    expect(
      screen.getByText(/Une connexion est nécessaire/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Obtenir une explication/i }),
    ).toBeDisabled();
  });

  it('détecte une explication stale sans régénérer automatiquement', async () => {
    const user = userEvent.setup();
    generateExerciseCoachExplanation.mockResolvedValue(explanation('fp-a'));
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const { rerender } = render(
      <QueryClientProvider client={client}>
        <ExerciseCoachAiExplanation
          exerciseId="ex-1"
          summary={summary({ coachSummaryFingerprint: 'fp-a' })}
          aiAvailable
        />
      </QueryClientProvider>,
    );
    await user.click(
      screen.getByRole('button', { name: /Obtenir une explication/i }),
    );
    await screen.findByText(/Ta charge est restée/i);
    expect(generateExerciseCoachExplanation).toHaveBeenCalledTimes(1);

    rerender(
      <QueryClientProvider client={client}>
        <ExerciseCoachAiExplanation
          exerciseId="ex-1"
          summary={summary({ coachSummaryFingerprint: 'fp-b' })}
          aiAvailable
        />
      </QueryClientProvider>,
    );
    expect(
      screen.getByText(/correspond à des données précédentes/i),
    ).toBeInTheDocument();
    expect(generateExerciseCoachExplanation).toHaveBeenCalledTimes(1);
  });

  it('affiche une erreur contrôlée', async () => {
    const user = userEvent.setup();
    generateExerciseCoachExplanation.mockRejectedValue(
      new Error('L’explication IA n’est pas disponible pour le moment.'),
    );
    render(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { mutations: { retry: false } },
          })
        }
      >
        <ExerciseCoachAiExplanation
          exerciseId="ex-1"
          summary={summary()}
          aiAvailable
        />
      </QueryClientProvider>,
    );
    await user.click(
      screen.getByRole('button', { name: /Obtenir une explication/i }),
    );
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
