import type { ExerciseMeasurementType } from '@gym-companion/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api/client';

import { loadRecommendationQueryOptions } from '../api/coaching-query-options';
import {
  formatEvidenceSummary,
  formatLoadWeightTransition,
  getLoadRecommendationActionLabel,
  getPrimaryLoadRecommendationMessage,
} from '../lib/load-recommendation-labels';
import { LoadRecommendationDetailDialog } from './LoadRecommendationDetailDialog';

type LoadRecommendationCardProps = {
  workoutTemplateExerciseId: string;
  exerciseId: string;
  measurementType: ExerciseMeasurementType;
};

export function LoadRecommendationCard({
  workoutTemplateExerciseId,
  exerciseId,
  measurementType,
}: LoadRecommendationCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const enabled = measurementType === 'WEIGHT_REPS';

  const query = useQuery({
    ...loadRecommendationQueryOptions(workoutTemplateExerciseId),
    enabled,
  });

  if (!enabled) {
    return (
      <p className="mt-3 text-xs text-[var(--muted)]">
        Aucune recommandation de charge pour ce type d’exercice.
      </p>
    );
  }

  if (query.isLoading) {
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

        <div className="mt-3 flex flex-wrap gap-2">
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
      </section>

      <LoadRecommendationDetailDialog
        open={detailOpen}
        recommendation={data}
        onClose={() => setDetailOpen(false)}
      />
    </>
  );
}
