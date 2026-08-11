import type { PlateauAnalysis, PlateauReason, PlateauStatus } from '@gym-companion/shared';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
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
      <section aria-busy="true" aria-label="Tendance">
        <h2 className="section-title">Tendance</h2>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">Chargement…</p>
      </section>
    );
  }

  if (query.isError) {
    return (
      <section role="alert" aria-label="Tendance">
        <h2 className="section-title">Tendance</h2>
        <p className="mt-2 text-sm text-[var(--danger)]">
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
      <section aria-label="Tendance">
        <h2 className="section-title">Tendance</h2>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
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
    <section aria-label="Tendance" className="flex flex-col gap-3">
      <div>
        <h2 className="section-title">Tendance</h2>
        <p className="mt-1 text-base font-semibold">{statusLabel}</p>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">{primary}</p>
        {trend ? (
          <p className="mt-2 text-sm tabular-nums text-[var(--foreground)]">
            {trend}
          </p>
        ) : null}
      </div>

      {shouldShowReasons(analysis.status) && reasonMessages.length > 0 ? (
        <ul className="list-inside list-disc text-sm text-[var(--muted-foreground)]">
          {reasonMessages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}

      {analysis.evidence.length > 0 ? (
        <ul className="flex flex-col">
          {analysis.evidence.map((point) => (
            <li key={point.workoutSessionId}>
              <Link
                to={`/workouts/${point.workoutSessionId}`}
                className="flex min-h-11 items-center justify-between gap-3 border-b border-[var(--border)] py-2 text-sm"
              >
                <span>{formatPlateauEvidenceLine(point)}</span>
                <ChevronRight
                  className="size-4 shrink-0 text-[var(--muted-foreground)]"
                  aria-hidden="true"
                />
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
