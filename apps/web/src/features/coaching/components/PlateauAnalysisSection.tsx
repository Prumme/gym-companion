import type { PlateauAnalysis, PlateauReason, PlateauStatus } from '@gym-companion/shared';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { getApiErrorMessage } from '@/lib/api/client';

import { plateauAnalysisQueryOptions } from '@/features/coaching/api/coaching-query-options';
import {
  formatPlateauEvidenceLine,
  formatPlateauTrendLine,
  getPlateauPrimaryMessage,
  getPlateauReasonMessage,
  getPlateauStatusLabel,
} from '@/features/coaching/lib/plateau-labels';

type PlateauAnalysisSectionProps = {
  exerciseId: string;
  equipmentId?: string;
  enabled?: boolean;
};

export function PlateauAnalysisSection({
  exerciseId,
  equipmentId,
  enabled = true,
}: PlateauAnalysisSectionProps) {
  const query = useQuery({
    ...plateauAnalysisQueryOptions(exerciseId, { equipmentId }),
    enabled: enabled && Boolean(exerciseId),
  });

  if (!enabled) {
    return null;
  }

  if (query.isLoading) {
    return (
      <section
        className="rounded-[var(--radius)] border border-dashed border-[var(--border)] p-3 sm:p-4"
        aria-busy="true"
        aria-label="Analyse de progression"
      >
        <h2 className="text-sm font-medium text-[var(--muted)]">
          Analyse de progression
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Chargement…</p>
      </section>
    );
  }

  if (query.isError) {
    return (
      <section
        className="rounded-[var(--radius)] border border-[var(--border)] p-3 sm:p-4"
        role="alert"
        aria-label="Analyse de progression"
      >
        <h2 className="text-sm font-medium text-[var(--muted)]">
          Analyse de progression
        </h2>
        <p className="mt-1 text-sm text-[var(--danger)]">
          {getApiErrorMessage(
            query.error,
            'Impossible de charger l’analyse de progression.',
          )}
        </p>
      </section>
    );
  }

  const data = query.data;
  if (!data) {
    return null;
  }

  return <PlateauAnalysisContent analysis={data} />;
}

function PlateauAnalysisContent({ analysis }: { analysis: PlateauAnalysis }) {
  if (!analysis.supported) {
    return (
      <section
        className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4"
        aria-label="Analyse de progression"
      >
        <h2 className="text-sm font-medium text-[var(--muted)]">
          Analyse de progression
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Aucune analyse de stagnation pour ce type d’exercice.
        </p>
      </section>
    );
  }

  const statusLabel = getPlateauStatusLabel(analysis.status);
  const primary = getPlateauPrimaryMessage(analysis);
  const trend = formatPlateauTrendLine(analysis);
  const reasonMessages = analysis.reasons
    .map((reason) => getPlateauReasonMessage(reason))
    .filter(Boolean);

  return (
    <section
      className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4"
      aria-label="Analyse de progression"
    >
      <h2 className="text-sm font-medium text-[var(--muted)]">
        Analyse de progression
      </h2>
      <p className="mt-1 text-base font-semibold">{statusLabel}</p>
      <p className="mt-1 text-sm text-[var(--muted)]">{primary}</p>
      {trend ? (
        <p className="mt-2 text-sm tabular-nums text-[var(--foreground)]">
          {trend}
        </p>
      ) : null}

      {shouldShowReasons(analysis.status) && reasonMessages.length > 0 ? (
        <ul className="mt-2 list-inside list-disc text-sm text-[var(--muted)]">
          {reasonMessages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}

      {analysis.evidence.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {analysis.evidence.map((point) => (
            <li key={point.workoutSessionId} className="text-sm">
              <Link
                to={`/workouts/${point.workoutSessionId}`}
                className="font-semibold text-[var(--primary)] underline-offset-2 hover:underline"
              >
                {formatPlateauEvidenceLine(point)}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function shouldShowReasons(status: PlateauStatus): boolean {
  return status === 'WATCH' || status === 'PLATEAU' || status === 'REVIEW';
}

export type { PlateauReason };
