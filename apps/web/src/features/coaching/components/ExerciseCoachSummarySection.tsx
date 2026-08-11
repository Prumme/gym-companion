import type { ExerciseCoachSummary } from '@gym-companion/shared';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
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
      <section aria-busy="true" aria-label="Coach Gym Companion">
        <h2 className="section-title">Coach</h2>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">Chargement…</p>
      </section>
    );
  }

  if (query.isError) {
    return (
      <section role="alert" aria-label="Coach Gym Companion">
        <h2 className="section-title">Coach</h2>
        <p className="mt-2 text-sm text-[var(--danger)]">
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
  const suggested =
    load?.suggestedWeightKg != null
      ? formatCoachWeightKg(load.suggestedWeightKg)
      : null;
  const current =
    load?.currentWeightKg != null
      ? formatCoachWeightKg(load.currentWeightKg)
      : null;
  const deltaKg =
    load?.suggestedWeightKg != null && load.currentWeightKg != null
      ? load.suggestedWeightKg - load.currentWeightKg
      : null;

  return (
    <section className="flex flex-col gap-[var(--space-5)]" aria-label="Coach Gym Companion">
      <div>
        <h2 className="section-title">Coach</h2>
        <p className="secondary-text mt-1">
          Analyse calculée par Gym Companion à partir de tes séances.
        </p>
      </div>

      <div>
        <h3 className="text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
          État
        </h3>
        <p className="mt-1 text-base font-semibold">
          {summary.headline.title || getExerciseCoachStatusLabel(summary.status)}
        </p>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          {summary.headline.description}
        </p>
      </div>

      {load ? (
        <div className="border-t border-[var(--border)] pt-[var(--space-4)]">
          <h3 className="text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
            Prochaine séance
          </h3>
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
            {suggested ?? current ?? getCoachLoadActionLabel(load.action)}
          </p>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {getCoachLoadActionLabel(load.action)}
            {current && suggested && current !== suggested
              ? ` · dernière cible ${current}`
              : null}
          </p>
          {deltaKg != null && deltaKg !== 0 ? (
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {deltaKg > 0 ? '+' : ''}
              {formatCoachWeightKg(deltaKg)} par rapport à ta dernière cible
            </p>
          ) : null}

          {decision ? (
            <p className="mt-3 text-sm text-[var(--foreground)]" role="status">
              {decision.decisionType === 'IGNORED'
                ? 'Recommandation ignorée'
                : `✓ Recommandation ${getCoachDecisionLabel(decision.decisionType).toLowerCase()}`}
              {decision.appliedWeightKg != null
                ? ` (${formatCoachWeightKg(decision.appliedWeightKg)})`
                : ''}
            </p>
          ) : null}

          {primaryAction ? (
            <div className="mt-4">
              <ButtonLink to={primaryAction.href} className="w-fit">
                {primaryAction.label}
              </ButtonLink>
            </div>
          ) : null}

          {summary.actions.length > 1 ? (
            <ul className="mt-3 flex flex-col">
              {summary.actions.slice(1).map((action) => (
                <li key={action.type}>
                  <Link
                    to={action.href}
                    className="flex min-h-11 items-center justify-between gap-3 border-b border-[var(--border)] py-2 text-sm font-medium"
                  >
                    {action.label}
                    <ChevronRight
                      className="size-4 text-[var(--muted-foreground)]"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : primaryAction ? (
        <div className="border-t border-[var(--border)] pt-[var(--space-4)]">
          <ButtonLink to={primaryAction.href} variant="secondary" className="w-fit">
            {primaryAction.label}
          </ButtonLink>
          {summary.actions.length > 1 ? (
            <ul className="mt-3 flex flex-col">
              {summary.actions.slice(1).map((action) => (
                <li key={action.type}>
                  <Link
                    to={action.href}
                    className="flex min-h-11 items-center justify-between gap-3 border-b border-[var(--border)] py-2 text-sm font-medium"
                  >
                    {action.label}
                    <ChevronRight
                      className="size-4 text-[var(--muted-foreground)]"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {summary.notices.length > 0 ? (
        <ul className="space-y-1">
          {summary.notices.map((notice) => (
            <li
              key={notice.code}
              className="text-sm text-[var(--muted-foreground)]"
              role={notice.severity === 'ATTENTION' ? 'status' : undefined}
            >
              {notice.message}
            </li>
          ))}
        </ul>
      ) : null}

      {summary.plateau ? (
        <div className="border-t border-[var(--border)] pt-[var(--space-4)]">
          <h3 className="text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
            Tendance
          </h3>
          <p className="mt-1 text-sm font-medium">
            {summary.plateau.status === 'NONE'
              ? 'Pas de stagnation détectée'
              : summary.plateau.status === 'PLATEAU'
                ? 'Stagnation possible'
                : summary.plateau.status === 'WATCH'
                  ? 'Progression à surveiller'
                  : summary.plateau.status === 'INSUFFICIENT_DATA'
                    ? 'Pas encore assez de données'
                    : 'Analyse à vérifier'}
          </p>
        </div>
      ) : null}

      <ExerciseCoachAiExplanation
        exerciseId={summary.exercise.id}
        summary={summary}
        aiAvailable={aiAvailable}
      />
    </section>
  );
}
