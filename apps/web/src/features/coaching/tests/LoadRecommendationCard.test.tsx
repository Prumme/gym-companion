import type { LoadRecommendation } from '@gym-companion/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LoadRecommendationCard } from '../components/LoadRecommendationCard';

const {
  getLoadRecommendation,
  listLoadRecommendationDecisions,
  decideLoadRecommendation,
} = vi.hoisted(() => ({
  getLoadRecommendation: vi.fn(),
  listLoadRecommendationDecisions: vi.fn(),
  decideLoadRecommendation: vi.fn(),
}));

vi.mock('../api/coaching-api', () => ({
  getLoadRecommendation: (...args: unknown[]) => getLoadRecommendation(...args),
  listLoadRecommendationDecisions: (...args: unknown[]) =>
    listLoadRecommendationDecisions(...args),
  decideLoadRecommendation: (...args: unknown[]) =>
    decideLoadRecommendation(...args),
}));

vi.mock('@/features/workouts/offline/command-id', () => ({
  createClientCommandId: () => 'cmd-test-1',
}));

function baseRecommendation(
  overrides: Partial<LoadRecommendation> = {},
): LoadRecommendation {
  return {
    workoutTemplateExerciseId: 'wte-1',
    exerciseId: 'ex-1',
    supported: true,
    action: 'HOLD',
    currentTarget: {
      weightKg: 80,
      minReps: 8,
      maxReps: 10,
      targetRir: 2,
      targetRpe: null,
    },
    recommendation: {
      suggestedWeightKg: 80,
      adjustmentKg: 0,
      incrementKg: 2.5,
      incrementSource: 'SYSTEM_DEFAULT',
    },
    evidence: {
      workoutCount: 1,
      latestWorkoutDate: '2026-08-01',
      effortDataUsed: false,
      recentWorkouts: [
        {
          workoutSessionId: 'ws-1',
          localDate: '2026-08-01',
          targetWeightKg: 80,
          completedSetCount: 3,
          partialSetCount: 0,
          failedSetCount: 0,
          performedReps: [10, 9, 8],
          actualRir: null,
          actualRpe: null,
        },
      ],
    },
    reasons: ['TARGET_RANGE_PARTIALLY_REACHED'],
    engineVersion: 'LOAD_RECOMMENDATION_V1',
    recommendationFingerprint: 'fp-test',
    ...overrides,
  };
}

function renderCard(
  measurementType: 'WEIGHT_REPS' | 'BODYWEIGHT_REPS' = 'WEIGHT_REPS',
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return render(
    <LoadRecommendationCard
      programId="prog-1"
      workoutTemplateExerciseId="wte-1"
      exerciseId="ex-1"
      measurementType={measurementType}
      workingSetCount={3}
    />,
    { wrapper },
  );
}

describe('LoadRecommendationCard (5.1 + 5.2)', () => {
  beforeEach(() => {
    getLoadRecommendation.mockReset();
    listLoadRecommendationDecisions.mockReset();
    decideLoadRecommendation.mockReset();
    listLoadRecommendationDecisions.mockResolvedValue({
      data: [],
      pagination: { nextCursor: null, hasMore: false },
    });
  });

  it('affiche le loading puis INCREASE avec actions de décision', async () => {
    let resolveFn: ((value: LoadRecommendation) => void) | undefined;
    getLoadRecommendation.mockReturnValue(
      new Promise<LoadRecommendation>((resolve) => {
        resolveFn = resolve;
      }),
    );
    renderCard();
    expect(screen.getByText('Chargement…')).toBeInTheDocument();

    resolveFn?.(
      baseRecommendation({
        action: 'INCREASE',
        recommendation: {
          suggestedWeightKg: 82.5,
          adjustmentKg: 2.5,
          incrementKg: 2.5,
          incrementSource: 'SYSTEM_DEFAULT',
        },
        reasons: ['TARGET_RANGE_REACHED'],
        evidence: {
          workoutCount: 3,
          latestWorkoutDate: '2026-08-03',
          effortDataUsed: true,
          recentWorkouts: [
            {
              workoutSessionId: 'ws-3',
              localDate: '2026-08-03',
              targetWeightKg: 80,
              completedSetCount: 3,
              partialSetCount: 0,
              failedSetCount: 0,
              performedReps: [10, 10, 10],
              actualRir: [2, 2, 2],
              actualRpe: null,
            },
          ],
        },
      }),
    );

    await waitFor(() => {
      expect(screen.getByText('Augmenter la charge')).toBeInTheDocument();
    });
    expect(screen.getByText(/80\s*kg\s*→\s*82,5\s*kg/)).toBeInTheDocument();
    expect(screen.getByText(/Basé sur 3 séances/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Appliquer' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Choisir une autre charge' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ignorer' })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Voir la progression' }),
    ).toHaveAttribute('href', '/progress/exercises/ex-1');
  });

  it('affiche HOLD puis DECREASE sur des montages séparés', async () => {
    getLoadRecommendation.mockResolvedValue(baseRecommendation());
    const { unmount } = renderCard();
    await screen.findByText('Conserver la charge');
    unmount();

    getLoadRecommendation.mockResolvedValue(
      baseRecommendation({
        action: 'DECREASE',
        recommendation: {
          suggestedWeightKg: 75,
          adjustmentKg: -5,
          incrementKg: 2.5,
          incrementSource: 'SYSTEM_DEFAULT',
        },
        reasons: ['TARGET_RANGE_NOT_REACHED', 'RECENT_FAILURES'],
      }),
    );
    renderCard();
    await screen.findByText('Réduire la charge');
    expect(screen.getByText(/80\s*kg\s*→\s*75\s*kg/)).toBeInTheDocument();
  });

  it('affiche REVIEW et INSUFFICIENT avec messages dédiés', async () => {
    getLoadRecommendation.mockResolvedValue(
      baseRecommendation({
        action: 'REVIEW',
        recommendation: {
          suggestedWeightKg: null,
          adjustmentKg: null,
          incrementKg: null,
          incrementSource: null,
        },
        reasons: ['UNSUPPORTED_TARGET_CONFIGURATION'],
      }),
    );
    renderCard();
    await screen.findByText('Progression à vérifier');
    expect(
      screen.getByText(/plusieurs charges ou plages/i),
    ).toBeInTheDocument();
  });

  it('état sans historique', async () => {
    getLoadRecommendation.mockResolvedValue(
      baseRecommendation({
        action: 'INSUFFICIENT_DATA',
        recommendation: {
          suggestedWeightKg: null,
          adjustmentKg: null,
          incrementKg: null,
          incrementSource: null,
        },
        evidence: {
          workoutCount: 0,
          latestWorkoutDate: null,
          effortDataUsed: false,
          recentWorkouts: [],
        },
        reasons: ['NO_ELIGIBLE_HISTORY'],
      }),
    );
    renderCard();
    await screen.findByText('Pas encore assez de données');
    expect(
      screen.getByText(/Pas encore assez de séances terminées/i),
    ).toBeInTheDocument();
  });

  it('ouvre le détail avec RIR et ferme le dialog', async () => {
    const user = userEvent.setup();
    getLoadRecommendation.mockResolvedValue(
      baseRecommendation({
        action: 'INCREASE',
        recommendation: {
          suggestedWeightKg: 82.5,
          adjustmentKg: 2.5,
          incrementKg: 2.5,
          incrementSource: 'SYSTEM_DEFAULT',
        },
        evidence: {
          workoutCount: 1,
          latestWorkoutDate: '2026-08-01',
          effortDataUsed: true,
          recentWorkouts: [
            {
              workoutSessionId: 'ws-1',
              localDate: '2026-08-01',
              targetWeightKg: 80,
              completedSetCount: 3,
              partialSetCount: 0,
              failedSetCount: 0,
              performedReps: [10, 10, 10],
              actualRir: [2, 2, 2],
              actualRpe: [8, 8, 8],
            },
          ],
        },
        reasons: ['TARGET_RANGE_REACHED', 'EFFORT_ON_TARGET'],
      }),
    );
    renderCard();
    await screen.findByText('Augmenter la charge');
    await user.click(screen.getByRole('button', { name: 'Voir le détail' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/RIR : 2 \/ 2 \/ 2/)).toBeInTheDocument();
    expect(within(dialog).getByText(/RPE : 8 \/ 8 \/ 8/)).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Incrément système par défaut/),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Fermer' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('n’appelle pas l’API pour un type non WEIGHT_REPS', () => {
    renderCard('BODYWEIGHT_REPS');
    expect(getLoadRecommendation).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Aucune recommandation de charge/i),
    ).toBeInTheDocument();
  });

  it('affiche une erreur réseau', async () => {
    getLoadRecommendation.mockRejectedValue(new Error('Network Error'));
    renderCard();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Network Error|Impossible de charger/i);
  });

  it('applique une recommandation via confirmation', async () => {
    const user = userEvent.setup();
    getLoadRecommendation.mockResolvedValue(
      baseRecommendation({
        action: 'INCREASE',
        recommendation: {
          suggestedWeightKg: 82.5,
          adjustmentKg: 2.5,
          incrementKg: 2.5,
          incrementSource: 'SYSTEM_DEFAULT',
        },
        reasons: ['TARGET_RANGE_REACHED'],
      }),
    );
    decideLoadRecommendation.mockResolvedValue({
      decision: {
        id: 'dec-1',
        engineVersion: 'LOAD_RECOMMENDATION_V1',
        recommendationFingerprint: 'fp-test',
        recommendationAction: 'INCREASE',
        decisionType: 'ACCEPTED',
        currentTargetWeightKg: 80,
        recommendedWeightKg: 82.5,
        appliedWeightKg: 82.5,
        incrementKg: 2.5,
        incrementSource: 'SYSTEM_DEFAULT',
        reasons: ['TARGET_RANGE_REACHED'],
        userNote: null,
        createdAt: '2026-08-10T10:00:00.000Z',
      },
      templateExercise: {},
      program: { id: 'prog-1' },
      recommendation: baseRecommendation({
        action: 'HOLD',
        currentTarget: {
          weightKg: 82.5,
          minReps: 8,
          maxReps: 10,
          targetRir: 2,
          targetRpe: null,
        },
        recommendation: {
          suggestedWeightKg: 82.5,
          adjustmentKg: 0,
          incrementKg: 2.5,
          incrementSource: 'SYSTEM_DEFAULT',
        },
        reasons: ['TARGET_RANGE_PARTIALLY_REACHED'],
        recommendationFingerprint: 'fp-after',
      }),
    });

    renderCard();
    await screen.findByText('Augmenter la charge');
    await user.click(screen.getByRole('button', { name: 'Appliquer' }));
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText(/passeront de 80 kg à 82,5 kg/i),
    ).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole('button', { name: /Appliquer 82,5 kg/i }),
    );
    await waitFor(() => {
      expect(decideLoadRecommendation).toHaveBeenCalledWith(
        'wte-1',
        expect.objectContaining({
          decision: 'ACCEPTED',
          recommendationFingerprint: 'fp-test',
          clientCommandId: 'cmd-test-1',
        }),
      );
    });
    expect(
      await screen.findByText(/mise à jour à 82,5 kg/i),
    ).toBeInTheDocument();
  });

  it('n’affiche pas Appliquer pour REVIEW', async () => {
    getLoadRecommendation.mockResolvedValue(
      baseRecommendation({
        action: 'REVIEW',
        recommendation: {
          suggestedWeightKg: null,
          adjustmentKg: null,
          incrementKg: null,
          incrementSource: null,
        },
        reasons: ['UNSUPPORTED_TARGET_CONFIGURATION'],
      }),
    );
    renderCard();
    await screen.findByText('Progression à vérifier');
    expect(
      screen.queryByRole('button', { name: 'Appliquer' }),
    ).not.toBeInTheDocument();
  });

  it('affiche l’historique des décisions', async () => {
    getLoadRecommendation.mockResolvedValue(baseRecommendation());
    listLoadRecommendationDecisions.mockResolvedValue({
      data: [
        {
          id: 'd1',
          engineVersion: 'LOAD_RECOMMENDATION_V1',
          recommendationAction: 'INCREASE',
          decisionType: 'ADJUSTED',
          currentTargetWeightKg: 80,
          recommendedWeightKg: 82.5,
          appliedWeightKg: 81.5,
          reasons: ['TARGET_RANGE_REACHED'],
          latestEvidenceWorkoutDate: '2026-08-10',
          userNote: null,
          createdAt: '2026-08-10T12:00:00.000Z',
        },
      ],
      pagination: { nextCursor: null, hasMore: false },
    });
    renderCard();
    await screen.findByText('Décisions récentes');
    expect(screen.getByText(/Ajustée à 81,5 kg/)).toBeInTheDocument();
  });

  it('variant compact: ligne courte avec Voir, sans grosse card', async () => {
    getLoadRecommendation.mockResolvedValue(
      baseRecommendation({
        action: 'INCREASE',
        recommendation: {
          suggestedWeightKg: 82.5,
          adjustmentKg: 2.5,
          incrementKg: 2.5,
          incrementSource: 'SYSTEM_DEFAULT',
        },
      }),
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <LoadRecommendationCard
            programId="prog-1"
            workoutTemplateExerciseId="wte-1"
            exerciseId="ex-1"
            measurementType="WEIGHT_REPS"
            workingSetCount={3}
            variant="compact"
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('82,5 kg')).toBeInTheDocument();
    expect(screen.getByText(/Suggestion/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Voir$/i })).toBeInTheDocument();
    expect(
      screen.queryByText(/Suggestion pour la prochaine séance/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Appliquer' }),
    ).not.toBeInTheDocument();
  });

  it('variant compact: ne rend rien si non supporté', async () => {
    getLoadRecommendation.mockResolvedValue({
      ...baseRecommendation(),
      supported: false,
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <LoadRecommendationCard
            programId="prog-1"
            workoutTemplateExerciseId="wte-1"
            exerciseId="ex-1"
            measurementType="WEIGHT_REPS"
            workingSetCount={3}
            variant="compact"
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => {
      expect(getLoadRecommendation).toHaveBeenCalled();
      expect(screen.queryByText(/Suggestion/i)).not.toBeInTheDocument();
    });
    expect(
      screen.queryByText(/Suggestion pour la prochaine séance/i),
    ).not.toBeInTheDocument();
  });
});
