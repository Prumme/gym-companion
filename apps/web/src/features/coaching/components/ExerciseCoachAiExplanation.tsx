import type {
  AiCoachExplanationFocus,
  ExerciseCoachExplanationResponse,
  ExerciseCoachSummary,
} from '@gym-companion/shared';
import { resolveAvailableAiCoachFocuses } from '@gym-companion/validation';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { Button, ButtonLink } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api/client';

import { generateExerciseCoachExplanation } from '../api/coaching-api';

const FOCUS_LABELS: Record<AiCoachExplanationFocus, string> = {
  GENERAL: 'Vue générale',
  LOAD: 'Ma charge',
  PROGRESS: 'Ma progression',
  PLATEAU: 'Ma stagnation',
};

type ExerciseCoachAiExplanationProps = {
  exerciseId: string;
  summary: ExerciseCoachSummary;
  aiAvailable: boolean;
};

export function ExerciseCoachAiExplanation({
  exerciseId,
  summary,
  aiAvailable,
}: ExerciseCoachAiExplanationProps) {
  const [offline, setOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  );
  const [focus, setFocus] = useState<AiCoachExplanationFocus>('GENERAL');
  const [result, setResult] =
    useState<ExerciseCoachExplanationResponse | null>(null);

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const availableFocuses = resolveAvailableAiCoachFocuses({
    hasLoadRecommendation: summary.loadRecommendation != null,
    hasProgress: summary.progress != null && summary.progress.workoutCount > 0,
    hasPlateauSignal:
      summary.plateau != null &&
      (summary.plateau.status === 'WATCH' ||
        summary.plateau.status === 'PLATEAU' ||
        summary.plateau.status === 'REVIEW'),
  });

  useEffect(() => {
    if (!availableFocuses.includes(focus)) {
      setFocus('GENERAL');
    }
  }, [availableFocuses, focus]);

  const mutation = useMutation({
    mutationFn: () =>
      generateExerciseCoachExplanation(exerciseId, { focus }),
    onSuccess: (data) => {
      setResult(data);
    },
  });

  const isStale =
    result != null &&
    result.meta.coachSummaryFingerprint !== summary.coachSummaryFingerprint;

  return (
    <section
      className="border-t border-[var(--border)] pt-[var(--space-5)]"
      aria-labelledby="ai-explanation-heading"
    >
      <h3
        id="ai-explanation-heading"
        className="text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase"
      >
        Explication IA
      </h3>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        Optionnelle — n’est pas la source de la recommandation ci-dessus.
      </p>

      {!aiAvailable ? (
        <p className="mt-3 text-sm text-[var(--muted-foreground)]">
          Indisponible sur cet environnement. L’analyse Coach ci-dessus reste
          disponible sans IA.
        </p>
      ) : (
        <>
          <fieldset className="mt-3">
            <legend className="sr-only">Focus de l’explication</legend>
            <div className="flex flex-wrap gap-2">
              {availableFocuses.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`min-h-10 rounded-[var(--radius-control)] border px-3 text-sm ${
                    focus === value
                      ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]'
                      : 'border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]'
                  }`}
                  aria-pressed={focus === value}
                  onClick={() => setFocus(value)}
                  disabled={mutation.isPending}
                >
                  {FOCUS_LABELS[value]}
                </button>
              ))}
            </div>
          </fieldset>

          {offline ? (
            <p className="mt-3 text-sm text-[var(--muted-foreground)]" role="status">
              Une connexion est nécessaire pour générer une explication.
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              className="min-h-11"
              disabled={offline || mutation.isPending}
              aria-busy={mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending
                ? 'Génération de l’explication…'
                : result
                  ? 'Régénérer'
                  : 'Générer une explication'}
            </Button>
            <ButtonLink
              to={`/coach/chat?exerciseId=${encodeURIComponent(exerciseId)}`}
              variant="ghost"
              className="min-h-11"
            >
              Poser une question
            </ButtonLink>
          </div>

          {mutation.isError ? (
            <div className="mt-3" role="alert">
              <p className="text-sm text-[var(--danger)]">
                {getApiErrorMessage(
                  mutation.error,
                  'L’explication IA est momentanément indisponible.',
                )}
              </p>
              <button
                type="button"
                className="mt-2 min-h-11 text-sm font-medium underline-offset-2 hover:underline"
                onClick={() => mutation.mutate()}
              >
                Réessayer
              </button>
            </div>
          ) : null}

          {result ? (
            <div className="mt-4 space-y-2" aria-live="polite">
              {isStale ? (
                <p className="text-sm text-[var(--muted-foreground)]" role="status">
                  Cette explication correspond à des données précédentes.
                </p>
              ) : null}
              <h4 className="text-base font-semibold">{result.explanation.title}</h4>
              <p className="text-sm leading-relaxed">{result.explanation.summary}</p>
              {result.explanation.keyPoints.length > 0 ? (
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {result.explanation.keyPoints.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              ) : null}
              {result.explanation.caution ? (
                <p className="text-sm text-[var(--muted-foreground)]" role="note">
                  {result.explanation.caution}
                </p>
              ) : null}
              <p className="text-xs text-[var(--muted-foreground)]">
                Généré à partir de tes données d’entraînement.
              </p>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
