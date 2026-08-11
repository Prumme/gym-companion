import type { ExerciseMeasurementType } from '@gym-companion/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { programQueryKeys } from '@/features/programs/api/program-query-keys';
import { getApiErrorMessage, type ApiRequestError } from '@/lib/api/client';
import { createClientCommandId } from '@/features/workouts/offline/command-id';

import { decideLoadRecommendation } from '../api/coaching-api';
import { coachingQueryKeys } from '../api/coaching-query-keys';
import {
  loadRecommendationDecisionsQueryOptions,
  loadRecommendationQueryOptions,
} from '../api/coaching-query-options';
import {
  formatDecisionHistoryLine,
  formatEvidenceSummary,
  formatLoadWeightKg,
  formatLoadWeightTransition,
  getLoadRecommendationActionLabel,
  getPrimaryLoadRecommendationMessage,
  isLoadRecommendationActionable,
} from '../lib/load-recommendation-labels';
import { LoadRecommendationDecisionDialogs } from './LoadRecommendationDecisionDialogs';
import { LoadRecommendationDetailDialog } from './LoadRecommendationDetailDialog';

type LoadRecommendationCardProps = {
  programId: string;
  workoutTemplateExerciseId: string;
  exerciseId: string;
  measurementType: ExerciseMeasurementType;
  workingSetCount: number;
  /** Compact line for Program Builder (UX-3). */
  variant?: 'default' | 'compact';
};

function getErrorCode(error: unknown): string | null {
  const apiError = error as ApiRequestError | undefined;
  if (apiError && typeof apiError === 'object' && 'code' in apiError) {
    return String((apiError as { code?: string }).code ?? '') || null;
  }
  return null;
}

export function LoadRecommendationCard({
  programId,
  workoutTemplateExerciseId,
  exerciseId,
  measurementType,
  workingSetCount,
  variant = 'default',
}: LoadRecommendationCardProps) {
  const queryClient = useQueryClient();
  const [detailOpen, setDetailOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<
    'apply' | 'adjust' | 'ignore' | null
  >(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [staleNotice, setStaleNotice] = useState<string | null>(null);
  const enabled = measurementType === 'WEIGHT_REPS';

  const query = useQuery({
    ...loadRecommendationQueryOptions(workoutTemplateExerciseId),
    enabled,
  });
  const decisionsQuery = useQuery({
    ...loadRecommendationDecisionsQueryOptions(workoutTemplateExerciseId),
    enabled,
  });

  const decideMutation = useMutation({
    mutationFn: ({
      input,
    }: {
      input: Parameters<typeof decideLoadRecommendation>[1];
    }) => decideLoadRecommendation(workoutTemplateExerciseId, input),
    onSuccess: (result) => {
      queryClient.setQueryData(programQueryKeys.detail(programId), result.program);
      if (result.recommendation) {
        queryClient.setQueryData(
          coachingQueryKeys.loadRecommendation(workoutTemplateExerciseId),
          result.recommendation,
        );
      } else {
        void queryClient.invalidateQueries({
          queryKey: coachingQueryKeys.loadRecommendation(
            workoutTemplateExerciseId,
          ),
        });
      }
      void queryClient.invalidateQueries({
        queryKey: coachingQueryKeys.loadRecommendationDecisions(
          workoutTemplateExerciseId,
        ),
      });
      void queryClient.invalidateQueries({
        queryKey: coachingQueryKeys.exerciseSummaries(),
      });
      void queryClient.invalidateQueries({
        queryKey: coachingQueryKeys.overview(),
      });
      setDialogMode(null);
      setDialogError(null);
      setStaleNotice(null);
      if (result.decision.decisionType === 'IGNORED') {
        setStatusMessage('Recommandation ignorée.');
      } else if (result.decision.appliedWeightKg != null) {
        setStatusMessage(
          `La charge cible a été mise à jour à ${formatLoadWeightKg(result.decision.appliedWeightKg)}.`,
        );
      } else {
        setStatusMessage('Décision enregistrée.');
      }
    },
  });

  async function submitDecision(
    decision: 'ACCEPTED' | 'ADJUSTED' | 'IGNORED',
    extras: { adjustedWeightKg?: number; userNote: string | null },
  ) {
    if (!query.data) return;
    if (!navigator.onLine) {
      setDialogError(
        'Une connexion est nécessaire pour modifier ton programme.',
      );
      return;
    }
    setDialogError(null);
    setStaleNotice(null);
    try {
      await decideMutation.mutateAsync({
        input: {
          recommendationFingerprint: query.data.recommendationFingerprint,
          decision,
          ...(extras.adjustedWeightKg != null
            ? { adjustedWeightKg: extras.adjustedWeightKg }
            : {}),
          userNote: extras.userNote,
          clientCommandId: createClientCommandId(),
        },
      });
    } catch (error) {
      const code = getErrorCode(error);
      if (code === 'LOAD_RECOMMENDATION_STALE') {
        setDialogMode(null);
        setStaleNotice(
          'Cette recommandation a changé depuis son affichage.',
        );
        await query.refetch();
        return;
      }
      setDialogError(
        getApiErrorMessage(error, 'Impossible d’enregistrer cette décision.'),
      );
    }
  }

  if (!enabled) {
    if (variant === 'compact') {
      return null;
    }
    return (
      <p className="mt-3 text-xs text-[var(--muted)]">
        Aucune recommandation de charge pour ce type d’exercice.
      </p>
    );
  }

  if (query.isLoading) {
    if (variant === 'compact') {
      return (
        <p className="mt-1 text-xs text-[var(--muted)]" aria-busy="true">
          Suggestion…
        </p>
      );
    }
    return (
      <div
        className="mt-3 rounded-[var(--radius)] border border-dashed border-[var(--border)] p-3"
        aria-busy="true"
        aria-live="polite"
      >
        <p className="text-xs font-medium text-[var(--muted)]">
          Suggestion pour la prochaine séance
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">Chargement…</p>
      </div>
    );
  }

  if (query.isError) {
    if (variant === 'compact') {
      return (
        <p className="mt-1 text-xs text-[var(--danger)]" role="alert">
          Suggestion indisponible
        </p>
      );
    }
    return (
      <div
        className="mt-3 rounded-[var(--radius)] border border-[var(--border)] p-3"
        role="alert"
      >
        <p className="text-xs font-medium text-[var(--muted)]">
          Suggestion pour la prochaine séance
        </p>
        <p className="mt-1 text-sm text-[var(--danger)]">
          {getApiErrorMessage(
            query.error,
            'Impossible de charger la suggestion de charge.',
          )}
        </p>
      </div>
    );
  }

  const data = query.data;
  if (!data || !data.supported) {
    if (variant === 'compact') {
      return null;
    }
    return (
      <p className="mt-3 text-xs text-[var(--muted)]">
        Aucune recommandation de charge pour ce type d’exercice.
      </p>
    );
  }

  const transition = formatLoadWeightTransition(
    data.currentTarget.weightKg,
    data.recommendation.suggestedWeightKg,
  );
  const evidence = formatEvidenceSummary(data);
  const actionable = isLoadRecommendationActionable(data.action);
  const decisions = decisionsQuery.data?.data ?? [];
  const compactValue =
    data.recommendation.suggestedWeightKg != null
      ? formatLoadWeightKg(data.recommendation.suggestedWeightKg)
      : getLoadRecommendationActionLabel(data.action);

  if (variant === 'compact') {
    return (
      <>
        <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
          <p className="min-w-0 truncate text-[var(--muted)]">
            Suggestion
            <span className="ml-1.5 font-medium text-[var(--foreground)] tabular-nums">
              {compactValue}
            </span>
          </p>
          <button
            type="button"
            className="shrink-0 font-medium text-[var(--muted)] underline-offset-2 hover:text-[var(--foreground)] hover:underline"
            onClick={() => setDetailOpen(true)}
          >
            Voir
          </button>
        </div>
        {statusMessage ? (
          <p className="mt-1 text-xs text-[var(--foreground)]" role="status">
            {statusMessage}
          </p>
        ) : null}
        {staleNotice ? (
          <div className="mt-1 flex flex-wrap items-center gap-2" role="status">
            <p className="text-xs text-[var(--muted-foreground)]">{staleNotice}</p>
            <button
              type="button"
              className="min-h-8 text-xs font-medium underline-offset-2 hover:underline"
              onClick={() => {
                setStaleNotice(null);
                void query.refetch();
              }}
            >
              Actualiser
            </button>
          </div>
        ) : null}

        <LoadRecommendationDetailDialog
          open={detailOpen}
          recommendation={data}
          onClose={() => setDetailOpen(false)}
        />

        <LoadRecommendationDecisionDialogs
          recommendation={data}
          workingSetCount={workingSetCount}
          pending={decideMutation.isPending}
          error={dialogError}
          mode={dialogMode}
          onClose={() => {
            if (!decideMutation.isPending) {
              setDialogMode(null);
              setDialogError(null);
            }
          }}
          onAccept={(userNote) =>
            void submitDecision('ACCEPTED', { userNote })
          }
          onAdjust={(adjustedWeightKg, userNote) =>
            void submitDecision('ADJUSTED', { adjustedWeightKg, userNote })
          }
          onIgnore={(userNote) => void submitDecision('IGNORED', { userNote })}
        />
      </>
    );
  }

  return (
    <>
      <section
        className="mt-3 rounded-[var(--radius)] border border-[var(--border)] bg-slate-50/80 p-3"
        aria-label="Suggestion pour la prochaine séance"
      >
        <p className="text-xs font-medium text-[var(--muted)]">
          Suggestion pour la prochaine séance
        </p>
        <p className="mt-1 text-sm font-semibold">
          {getLoadRecommendationActionLabel(data.action)}
        </p>
        {transition ? (
          <p className="mt-1 text-sm tabular-nums">{transition}</p>
        ) : null}
        <p className="mt-2 text-sm text-[var(--muted)]">
          {getPrimaryLoadRecommendationMessage(data)}
        </p>
        {evidence ? (
          <p className="mt-1 text-xs text-[var(--muted)]">{evidence}</p>
        ) : null}
        {data.evidence.latestWorkoutDate ? (
          <p className="text-xs text-[var(--muted)]">
            Dernière séance : {data.evidence.latestWorkoutDate}
          </p>
        ) : null}

        {staleNotice ? (
          <div className="mt-2 flex flex-wrap items-center gap-2" role="status">
            <p className="text-sm text-[var(--muted-foreground)]">{staleNotice}</p>
            <button
              type="button"
              className="min-h-11 text-sm font-medium underline-offset-2 hover:underline"
              onClick={() => {
                setStaleNotice(null);
                void query.refetch();
              }}
            >
              Actualiser
            </button>
          </div>
        ) : null}
        {statusMessage ? (
          <p className="mt-2 text-sm text-[var(--foreground)]" role="status">
            {statusMessage}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          {actionable ? (
            <>
              <Button
                type="button"
                className="min-h-10"
                disabled={decideMutation.isPending}
                onClick={() => {
                  setDialogError(null);
                  setDialogMode('apply');
                }}
              >
                {data.action === 'HOLD' ? 'Conserver cette charge' : 'Appliquer'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="min-h-10"
                disabled={decideMutation.isPending}
                onClick={() => {
                  setDialogError(null);
                  setDialogMode('adjust');
                }}
              >
                Choisir une autre charge
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="min-h-10"
                disabled={decideMutation.isPending}
                onClick={() => {
                  setDialogError(null);
                  setDialogMode('ignore');
                }}
              >
                Ignorer
              </Button>
            </>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            className="min-h-10"
            onClick={() => setDetailOpen(true)}
          >
            Voir le détail
          </Button>
          <Link
            to={`/progress/exercises/${encodeURIComponent(exerciseId)}`}
            className="inline-flex min-h-10 items-center rounded-[var(--radius)] px-3 text-sm font-semibold text-[var(--primary)] underline-offset-2 hover:underline"
          >
            Voir la progression
          </Link>
        </div>

        {decisions.length > 0 ? (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium">
              Décisions récentes
            </summary>
            <ul className="mt-2 space-y-2">
              {decisions.map((item) => (
                <li
                  key={item.id}
                  className="rounded-[var(--radius)] border border-[var(--border)] bg-white p-2 text-sm"
                >
                  <p className="text-xs text-[var(--muted)]">
                    {new Intl.DateTimeFormat('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    }).format(new Date(item.createdAt))}
                  </p>
                  <p className="mt-1">
                    {formatDecisionHistoryLine(item)}
                  </p>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <LoadRecommendationDetailDialog
        open={detailOpen}
        recommendation={data}
        onClose={() => setDetailOpen(false)}
      />

      <LoadRecommendationDecisionDialogs
        recommendation={data}
        workingSetCount={workingSetCount}
        pending={decideMutation.isPending}
        error={dialogError}
        mode={dialogMode}
        onClose={() => {
          if (!decideMutation.isPending) {
            setDialogMode(null);
            setDialogError(null);
          }
        }}
        onAccept={(userNote) =>
          void submitDecision('ACCEPTED', { userNote })
        }
        onAdjust={(adjustedWeightKg, userNote) =>
          void submitDecision('ADJUSTED', { adjustedWeightKg, userNote })
        }
        onIgnore={(userNote) => void submitDecision('IGNORED', { userNote })}
      />
    </>
  );
}
