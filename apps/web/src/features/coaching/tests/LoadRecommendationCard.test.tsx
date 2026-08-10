import type { LoadRecommendation } from '@gym-companion/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LoadRecommendationCard } from '../components/LoadRecommendationCard';

const { getLoadRecommendation } = vi.hoisted(() => ({
  getLoadRecommendation: vi.fn(),
}));

vi.mock('../api/coaching-api', () => ({
  getLoadRecommendation: (...args: unknown[]) => getLoadRecommendation(...args),
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
      workoutTemplateExerciseId="wte-1"
      exerciseId="ex-1"
      measurementType={measurementType}
    />,
    { wrapper },
  );
}

describe('LoadRecommendationCard (5.1)', () => {
  beforeEach(() => {
    getLoadRecommendation.mockReset();
  });

  it('affiche le loading puis INCREASE avec transition de charge', async () => {
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
      screen.queryByRole('button', { name: /appliquer/i }),
    ).not.toBeInTheDocument();
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
});
