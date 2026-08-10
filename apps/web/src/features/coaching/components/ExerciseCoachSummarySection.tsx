import type { ExerciseCoachSummary } from '@gym-companion/shared';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { ButtonLink } from '@/components/ui/button';
import { getMe } from '@/features/profile/api/profile-api';
import { getApiErrorMessage } from '@/lib/api/client';

import { exerciseCoachSummaryQueryOptions } from '../api/coaching-query-options';
import {
  formatCoachWeightKg,
  getCoachDecisionLabel,
  getCoachLoadActionLabel,
  getExerciseCoachStatusLabel,
} from '../lib/coach-labels';
import { ExerciseCoachAiExplanation } from './ExerciseCoachAiExplanation';

type ExerciseCoachSummarySectionProps = {
  exerciseId: string;
  enabled?: boolean;
};

export function ExerciseCoachSummarySection({
  exerciseId,
  enabled = true,
}: ExerciseCoachSummarySectionProps) {
  const query = useQuery({
    ...exerciseCoachSummaryQueryOptions(exerciseId),
    enabled: enabled && Boolean(exerciseId),
  });
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    enabled: enabled && Boolean(exerciseId),
    staleTime: 60_000,
  });

  if (!enabled) return null;

  if (query.isLoading) {
    return (
      <section
        className="rounded-[var(--radius)] border border-dashed border-[var(--border)] p-3 sm:p-4"
        aria-busy="true"
        aria-label="Coach"
      >
        <h2 className="text-sm font-medium text-[var(--muted)]">Coach</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Chargement…</p>
      </section>
    );
  }

  if (query.isError) {
    return (
      <section
        className="rounded-[var(--radius)] border border-[var(--border)] p-3 sm:p-4"
        role="alert"
        aria-label="Coach"
      >
        <h2 className="text-sm font-medium text-[var(--muted)]">Coach</h2>
        <p className="mt-1 text-sm text-[var(--danger)]">
          {getApiErrorMessage(
            query.error,
            'Impossible de charger la synthèse Coach.',
          )}
        </p>
      </section>
    );
  }

  if (!query.data) return null;
  return (
    <CoachSummaryContent
      summary={query.data}
      aiAvailable={meQuery.data?.data.ai.available === true}
    />
  );
}

function CoachSummaryContent({
  summary,
  aiAvailable,
}: {
  summary: ExerciseCoachSummary;
  aiAvailable: boolean;
}) {
  const primaryAction = summary.actions[0] ?? null;
  const load = summary.loadRecommendation;
  const decision = summary.recentDecision;

  return (
    <section
      className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4"
      aria-label="Coach"
    >
      <h2 className="text-sm font-medium text-[var(--muted)]">Coach</h2>
      <p className="mt-1 text-base font-semibold">
        {summary.headline.title || getExerciseCoachStatusLabel(summary.status)}
      </p>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {summary.headline.description}
      </p>

      {load ? (
        <p className="mt-3 text-sm">
          Recommandation actuelle :{' '}
          <span className="font-semibold">
            {getCoachLoadActionLabel(load.action)}
            {load.suggestedWeightKg != null
              ? ` (${formatCoachWeightKg(load.suggestedWeightKg)})`
              : load.currentWeightKg != null
                ? ` (${formatCoachWeightKg(load.currentWeightKg)})`
                : ''}
          </span>
        </p>
      ) : null}

      {decision ? (
        <p className="mt-2 text-sm text-[var(--muted)]">
          Dernière décision : {getCoachDecisionLabel(decision.decisionType)}
          {decision.decisionType === 'IGNORED'
            ? ' — tu as ignoré la dernière recommandation de charge.'
            : decision.appliedWeightKg != null
              ? ` (${formatCoachWeightKg(decision.appliedWeightKg)})`
              : ''}
        </p>
      ) : null}

      {summary.notices.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {summary.notices.map((notice) => (
            <li
              key={notice.code}
              className="text-sm text-[var(--muted)]"
              role={notice.severity === 'ATTENTION' ? 'status' : undefined}
            >
              {notice.message}
            </li>
          ))}
        </ul>
      ) : null}

      {primaryAction ? (
        <div className="mt-4">
          <ButtonLink to={primaryAction.href} className="min-h-10">
            {primaryAction.label}
          </ButtonLink>
        </div>
      ) : null}

      {summary.actions.length > 1 ? (
        <ul className="mt-3 flex flex-wrap gap-3 text-sm">
          {summary.actions.slice(1).map((action) => (
            <li key={action.type}>
              <Link
                to={action.href}
                className="font-semibold text-[var(--primary)] underline-offset-2 hover:underline"
              >
                {action.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <ExerciseCoachAiExplanation
        exerciseId={summary.exercise.id}
        summary={summary}
        aiAvailable={aiAvailable}
      />
    </section>
  );
}
