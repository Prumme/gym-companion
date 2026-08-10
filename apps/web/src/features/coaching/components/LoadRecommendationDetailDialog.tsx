import type { LoadRecommendation } from '@gym-companion/shared';
import { useId } from 'react';

import { Button } from '@/components/ui/button';

import {
  formatLoadWeightKg,
  formatLoadWeightTransition,
  getIncrementSourceLabel,
  getLoadRecommendationActionLabel,
  getLoadRecommendationReasonMessage,
  getPrimaryLoadRecommendationMessage,
} from '../lib/load-recommendation-labels';

type LoadRecommendationDetailDialogProps = {
  open: boolean;
  recommendation: LoadRecommendation;
  onClose: () => void;
};

export function LoadRecommendationDetailDialog({
  open,
  recommendation,
  onClose,
}: LoadRecommendationDetailDialogProps) {
  const titleId = useId();

  if (!open) {
    return null;
  }

  const transition = formatLoadWeightTransition(
    recommendation.currentTarget.weightKg,
    recommendation.recommendation.suggestedWeightKg,
  );
  const incrementLabel = getIncrementSourceLabel(
    recommendation.recommendation.incrementSource,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id={titleId} className="text-lg font-semibold">
          {getLoadRecommendationActionLabel(recommendation.action)}
        </h3>

        {transition ? (
          <p className="mt-2 text-base font-medium">{transition}</p>
        ) : null}

        <section className="mt-4" aria-label="Cible actuelle">
          <h4 className="text-sm font-medium text-[var(--muted)]">
            Cible actuelle
          </h4>
          <ul className="mt-1 space-y-1 text-sm">
            <li>
              Charge :{' '}
              {recommendation.currentTarget.weightKg != null
                ? formatLoadWeightKg(recommendation.currentTarget.weightKg)
                : '—'}
            </li>
            <li>
              Répétitions :{' '}
              {recommendation.currentTarget.minReps != null &&
              recommendation.currentTarget.maxReps != null
                ? `${recommendation.currentTarget.minReps}–${recommendation.currentTarget.maxReps}`
                : '—'}
            </li>
            {recommendation.currentTarget.targetRir != null ? (
              <li>RIR cible : {recommendation.currentTarget.targetRir}</li>
            ) : null}
            {recommendation.currentTarget.targetRpe != null ? (
              <li>RPE cible : {recommendation.currentTarget.targetRpe}</li>
            ) : null}
          </ul>
        </section>

        <section className="mt-4" aria-label="Raisons">
          <h4 className="text-sm font-medium text-[var(--muted)]">Raisons</h4>
          <p className="mt-1 text-sm">
            {getPrimaryLoadRecommendationMessage(recommendation)}
          </p>
          {recommendation.reasons.length > 1 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
              {recommendation.reasons.slice(1).map((reason) => (
                <li key={reason}>
                  {getLoadRecommendationReasonMessage(reason)}
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        {recommendation.evidence.recentWorkouts.length > 0 ? (
          <section className="mt-4" aria-label="Séances récentes">
            <h4 className="text-sm font-medium text-[var(--muted)]">
              Séances récentes analysées
            </h4>
            <ul className="mt-2 space-y-3">
              {recommendation.evidence.recentWorkouts.map((workout) => (
                <li
                  key={workout.workoutSessionId}
                  className="rounded-[var(--radius)] border border-[var(--border)] p-3 text-sm"
                >
                  <p className="font-medium">{workout.localDate}</p>
                  <p className="text-[var(--muted)]">
                    Reps :{' '}
                    {workout.performedReps.length > 0
                      ? workout.performedReps.join(' / ')
                      : '—'}
                  </p>
                  <p className="text-[var(--muted)]">
                    Terminées {workout.completedSetCount} · Partielles{' '}
                    {workout.partialSetCount} · Échouées{' '}
                    {workout.failedSetCount}
                  </p>
                  {workout.actualRir ? (
                    <p className="text-[var(--muted)]">
                      RIR : {workout.actualRir.join(' / ')}
                    </p>
                  ) : null}
                  {workout.actualRpe ? (
                    <p className="text-[var(--muted)]">
                      RPE : {workout.actualRpe.join(' / ')}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {incrementLabel &&
        recommendation.recommendation.incrementKg != null ? (
          <section className="mt-4" aria-label="Incrément">
            <h4 className="text-sm font-medium text-[var(--muted)]">
              Règle d’incrément
            </h4>
            <p className="mt-1 text-sm">
              {incrementLabel} :{' '}
              {formatLoadWeightKg(recommendation.recommendation.incrementKg)}
            </p>
          </section>
        ) : null}

        <div className="mt-4 flex justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
}
