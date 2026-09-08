import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Copy, Sparkles } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ProgramImportError, ProgramImportPreview } from '@gym-companion/shared';
import { getApiErrorMessage, type ApiRequestError } from '@/lib/api/client';
import { Button, ButtonLink } from '@/components/ui/button';
import {
  muscleGroupsQueryOptions,
  systemExerciseCatalogQueryOptions,
} from '@/features/exercises/api/exercise-query-options';

import {
  useImportProgramFromJsonMutation,
  useValidateProgramImportMutation,
} from '../hooks/use-program-import-mutations';
import { describeProgramImportError } from '../lib/program-import-errors';
import { formatGroupedSetSummaries } from '../lib/program-import-preview';
import { parseImportedJsonText } from '../lib/parse-imported-json';
import {
  EMPTY_PROGRAM_IMPORT_BRIEF,
  DURATION_OPTIONS,
  EQUIPMENT_PREFERENCES,
  EXPERIENCE_LEVELS,
  buildProgramImportCorrectionPrompt,
  buildProgramImportPrompt,
  type ProgramImportBrief,
  type ProgramImportEquipmentPreference,
} from '../lib/program-import-prompt';
import { TRAINING_GOAL_OPTIONS, getTrainingGoalLabel } from '../lib/program-labels';

const fieldClass =
  'min-h-11 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] px-3 outline-none focus:border-[var(--primary)]';

const EXPERIENCE_LABELS: Record<(typeof EXPERIENCE_LEVELS)[number], string> = {
  BEGINNER: 'Débutant',
  INTERMEDIATE: 'Intermédiaire',
  ADVANCED: 'Avancé',
};

const EQUIPMENT_LABELS: Record<ProgramImportEquipmentPreference, string> = {
  machines: 'Machines',
  'free-weights': 'Poids libres',
  mixed: 'Mixte',
};

function useOnline(): boolean {
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  useEffect(() => {
    function onOnline() {
      setOnline(true);
    }
    function onOffline() {
      setOnline(false);
    }
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);
  return online;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function ProgramImportPage() {
  const navigate = useNavigate();
  const online = useOnline();
  const promptId = useId();
  const jsonId = useId();
  const catalogQuery = useQuery(systemExerciseCatalogQueryOptions());
  const musclesQuery = useQuery(muscleGroupsQueryOptions());
  const validateMutation = useValidateProgramImportMutation();
  const importMutation = useImportProgramFromJsonMutation();

  const [brief, setBrief] = useState<ProgramImportBrief>(EMPTY_PROGRAM_IMPORT_BRIEF);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [jsonText, setJsonText] = useState('');
  const [syntaxError, setSyntaxError] = useState<string | null>(null);
  const [errors, setErrors] = useState<ProgramImportError[]>([]);
  const [parsedPayload, setParsedPayload] = useState<unknown>(null);
  const [preview, setPreview] = useState<ProgramImportPreview | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const catalog = catalogQuery.data;
  const muscles = useMemo(
    () => musclesQuery.data ?? [],
    [musclesQuery.data],
  );

  const generatedPrompt = useMemo(() => {
    if (!catalog || catalog.length === 0) {
      return '';
    }
    return buildProgramImportPrompt(brief, catalog, muscles);
  }, [brief, catalog, muscles]);

  function resetValidation() {
    setSyntaxError(null);
    setErrors([]);
    setPreview(null);
    setParsedPayload(null);
    setSubmitError(null);
  }

  function handleGeneratePrompt() {
    setPrompt(generatedPrompt);
    setStatus(null);
  }

  async function handleCopyPrompt() {
    const text = prompt ?? generatedPrompt;
    if (!text) return;
    const ok = await copyText(text);
    setStatus(ok ? 'Prompt copié' : 'Impossible de copier le prompt.');
  }

  async function handleCopyCorrection() {
    if (errors.length === 0 || !jsonText.trim()) return;
    const text = buildProgramImportCorrectionPrompt({
      jsonText,
      errors,
      catalog: catalog ?? [],
    });
    const ok = await copyText(text);
    setStatus(ok ? 'Prompt de correction copié' : 'Impossible de copier le prompt.');
  }

  async function handleValidate() {
    resetValidation();
    if (!online) {
      setSubmitError('Connexion nécessaire pour vérifier et importer un programme.');
      return;
    }
    const parsed = parseImportedJsonText(jsonText);
    if (!parsed.ok) {
      setSyntaxError(parsed.message);
      return;
    }
    setParsedPayload(parsed.value);
    try {
      const result = await validateMutation.mutateAsync(parsed.value);
      if (result.valid && result.preview) {
        setPreview(result.preview);
        setErrors([]);
      } else {
        setPreview(null);
        setErrors(result.errors);
      }
    } catch (error) {
      const apiError = error as ApiRequestError;
      const details = apiError.details as { errors?: ProgramImportError[] } | undefined;
      if (details?.errors && details.errors.length > 0) {
        setErrors(details.errors);
        return;
      }
      setSubmitError(
        getApiErrorMessage(error, 'Impossible de vérifier ce JSON.'),
      );
    }
  }

  async function handleImport() {
    if (!online) {
      setSubmitError('Connexion nécessaire pour vérifier et importer un programme.');
      return;
    }
    const parsed = parseImportedJsonText(jsonText);
    if (!parsed.ok) {
      setSyntaxError(parsed.message);
      setPreview(null);
      return;
    }
    try {
      const detail = await importMutation.mutateAsync(parsed.value);
      void navigate(`/programs/${detail.id}`, {
        replace: true,
        state: { flash: 'Programme importé' },
      });
    } catch (error) {
      const apiError = error as ApiRequestError;
      const details = apiError.details as { errors?: ProgramImportError[] } | undefined;
      if (details?.errors && details.errors.length > 0) {
        setPreview(null);
        setErrors(details.errors);
        setParsedPayload(parsed.value);
        return;
      }
      setSubmitError(
        getApiErrorMessage(error, 'Impossible d’importer ce programme.'),
      );
    }
  }

  function toggleMuscle(code: string) {
    setBrief((current) => {
      const selected = current.musclePriorities.includes(code)
        ? current.musclePriorities.filter((item) => item !== code)
        : [...current.musclePriorities, code];
      return { ...current, musclePriorities: selected };
    });
  }

  const canGenerate = Boolean(catalog && catalog.length > 0) && !catalogQuery.isError;
  const pending = validateMutation.isPending || importMutation.isPending;
  const canImport = Boolean(preview) && online && !pending;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 pb-8">
      <header className="flex items-start gap-2">
        <Link
          to="/programs"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] hover:bg-[var(--surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          aria-label="Retour aux programmes"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
        <div className="min-w-0 flex-1 pt-2">
          <h1 className="text-xl font-semibold tracking-tight">
            Importer avec une IA
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Gym Companion génère un prompt. Tu le colles dans l’IA de ton choix,
            puis tu colles le JSON ici. Aucune IA n’est appelée par l’application.
          </p>
        </div>
      </header>

      {status ? (
        <p className="text-sm text-[var(--foreground)]" role="status">
          {status}
        </p>
      ) : null}

      {!online ? (
        <p className="text-sm text-[var(--muted)]" role="status">
          Connexion nécessaire pour vérifier et importer un programme.
        </p>
      ) : null}

      <section className="flex flex-col gap-4" aria-labelledby="brief-title">
        <h2 id="brief-title" className="text-base font-semibold">
          1. Décrire mon programme
        </h2>

        <label className="flex flex-col gap-1.5 text-sm" htmlFor="import-goal">
          <span className="font-medium">Objectif</span>
          <select
            id="import-goal"
            className={fieldClass}
            value={brief.goal}
            onChange={(event) =>
              setBrief((current) => ({
                ...current,
                goal: event.target.value as ProgramImportBrief['goal'],
              }))
            }
          >
            {TRAINING_GOAL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm" htmlFor="import-workouts">
          <span className="font-medium">Nombre de séances</span>
          <select
            id="import-workouts"
            className={fieldClass}
            value={brief.workoutCount}
            onChange={(event) =>
              setBrief((current) => ({
                ...current,
                workoutCount: Number(event.target.value),
              }))
            }
          >
            {Array.from({ length: 7 }, (_, index) => index + 1).map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm" htmlFor="import-duration">
          <span className="font-medium">Durée approximative par séance</span>
          <select
            id="import-duration"
            className={fieldClass}
            value={brief.durationMinutes}
            onChange={(event) =>
              setBrief((current) => ({
                ...current,
                durationMinutes: Number(
                  event.target.value,
                ) as ProgramImportBrief['durationMinutes'],
              }))
            }
          >
            {DURATION_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} min
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm" htmlFor="import-level">
          <span className="font-medium">Niveau</span>
          <select
            id="import-level"
            className={fieldClass}
            value={brief.experienceLevel}
            onChange={(event) =>
              setBrief((current) => ({
                ...current,
                experienceLevel: event.target
                  .value as ProgramImportBrief['experienceLevel'],
              }))
            }
          >
            {EXPERIENCE_LEVELS.map((level) => (
              <option key={level} value={level}>
                {EXPERIENCE_LABELS[level]}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Priorités musculaires</legend>
          {musclesQuery.isLoading ? (
            <p className="text-sm text-[var(--muted)]">Chargement des groupes…</p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            {muscles.map((muscle) => (
              <label
                key={muscle.id}
                className="flex min-h-11 items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  className="size-4 rounded border-[var(--border)]"
                  checked={brief.musclePriorities.includes(muscle.code)}
                  onChange={() => toggleMuscle(muscle.code)}
                />
                {muscle.name}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex flex-col gap-1.5 text-sm" htmlFor="import-equipment">
          <span className="font-medium">Préférence matériel</span>
          <select
            id="import-equipment"
            className={fieldClass}
            value={brief.equipmentPreference}
            onChange={(event) =>
              setBrief((current) => ({
                ...current,
                equipmentPreference: event.target
                  .value as ProgramImportEquipmentPreference,
              }))
            }
          >
            {EQUIPMENT_PREFERENCES.map((value) => (
              <option key={value} value={value}>
                {EQUIPMENT_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm" htmlFor="import-free-text">
          <span className="font-medium">Décris plus précisément ce que tu souhaites</span>
          <textarea
            id="import-free-text"
            rows={5}
            className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] px-3 py-2 outline-none focus:border-[var(--primary)]"
            value={brief.freeText}
            onChange={(event) =>
              setBrief((current) => ({ ...current, freeText: event.target.value }))
            }
            placeholder="Ex. Je vais généralement à la salle trois fois par semaine, parfois quatre. Je veux surtout développer le haut du corps sans négliger les jambes."
          />
        </label>

        <p className="text-xs text-[var(--muted)]">
          Ces informations aident l’IA externe à proposer un programme. Ce n’est
          pas une prescription médicale ou sportive.
        </p>

        <Button
          type="button"
          className="w-full gap-2"
          disabled={!canGenerate}
          onClick={handleGeneratePrompt}
        >
          <Sparkles className="size-4" aria-hidden="true" />
          Générer le prompt
        </Button>
        {catalogQuery.isError ? (
          <p className="text-sm text-[var(--danger)]" role="alert">
            Impossible de charger le catalogue d’exercices.
          </p>
        ) : null}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="prompt-title">
        <h2 id="prompt-title" className="text-base font-semibold">
          2. Copier le prompt
        </h2>
        <textarea
          id={promptId}
          readOnly
          rows={12}
          className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-xs leading-relaxed"
          value={prompt ?? ''}
          placeholder="Génère d’abord le prompt à partir de ta description."
        />
        <Button
          type="button"
          variant="secondary"
          className="w-full gap-2"
          disabled={!prompt}
          onClick={() => void handleCopyPrompt()}
        >
          <Copy className="size-4" aria-hidden="true" />
          Copier le prompt
        </Button>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="json-title">
        <h2 id="json-title" className="text-base font-semibold">
          3. Coller le JSON
        </h2>
        <label className="flex flex-col gap-1.5 text-sm" htmlFor={jsonId}>
          <span className="font-medium">Colle ici le JSON généré par l’IA</span>
          <textarea
            id={jsonId}
            rows={14}
            className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-xs leading-relaxed outline-none focus:border-[var(--primary)]"
            value={jsonText}
            onChange={(event) => {
              setJsonText(event.target.value);
              resetValidation();
            }}
            spellCheck={false}
            autoComplete="off"
          />
        </label>
        <Button
          type="button"
          className="w-full"
          disabled={!online || pending || jsonText.trim().length === 0}
          onClick={() => void handleValidate()}
        >
          {validateMutation.isPending ? 'Vérification…' : 'Vérifier le JSON'}
        </Button>
      </section>

      {syntaxError ? (
        <div
          className="rounded-[var(--radius)] border border-red-200 bg-red-50 p-4"
          role="alert"
        >
          <p className="font-medium text-[var(--danger)]">JSON invalide</p>
          <p className="mt-1 text-sm text-[var(--danger)]">{syntaxError}</p>
        </div>
      ) : null}

      {errors.length > 0 ? (
        <section className="flex flex-col gap-3" aria-labelledby="errors-title">
          <h2 id="errors-title" className="text-base font-semibold">
            {errors.length} erreur{errors.length > 1 ? 's' : ''} trouvée
            {errors.length > 1 ? 's' : ''}
          </h2>
          <ul className="flex flex-col gap-3">
            {errors.map((error, index) => {
              const described = describeProgramImportError(error, parsedPayload);
              return (
                <li
                  key={`${error.path}-${index}`}
                  className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3"
                >
                  <p className="text-sm font-medium">{described.title}</p>
                  <p className="mt-1 whitespace-pre-line text-sm">
                    {described.message}
                  </p>
                  {error.suggestions && error.suggestions.length > 0 ? (
                    <p className="mt-2 text-sm">
                      Exercices possibles :
                      <br />
                      {error.suggestions.map((slug) => (
                        <span key={slug} className="block font-mono text-xs">
                          - {slug}
                        </span>
                      ))}
                    </p>
                  ) : null}
                  <p className="mt-2 font-mono text-xs text-[var(--muted)]">
                    {described.path}
                  </p>
                </li>
              );
            })}
          </ul>
          <Button
            type="button"
            variant="secondary"
            className="w-full gap-2"
            onClick={() => void handleCopyCorrection()}
          >
            <Copy className="size-4" aria-hidden="true" />
            Copier un prompt de correction
          </Button>
        </section>
      ) : null}

      {preview ? (
        <section className="flex flex-col gap-3" aria-labelledby="preview-title">
          <h2 id="preview-title" className="text-base font-semibold">
            4. Vérifier
          </h2>
          <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
            <p className="text-sm font-medium text-[var(--primary)]">JSON valide</p>
            <p className="mt-2 text-lg font-semibold">{preview.name}</p>
            <p className="text-sm text-[var(--muted)]">
              Objectif : {getTrainingGoalLabel(preview.goal)}
            </p>
            <p className="mt-1 text-sm">
              {preview.workoutCount} séance{preview.workoutCount > 1 ? 's' : ''} ·{' '}
              {preview.exerciseCount} exercice
              {preview.exerciseCount > 1 ? 's' : ''} · {preview.setCount} série
              {preview.setCount > 1 ? 's' : ''}
            </p>
          </div>
          {preview.workouts.map((workout) => (
            <article
              key={workout.name}
              className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4"
            >
              <h3 className="font-semibold">{workout.name}</h3>
              <p className="text-xs text-[var(--muted)]">
                {workout.estimatedDurationMinutes} min
              </p>
              <ul className="mt-3 flex flex-col gap-3">
                {workout.exercises.map((exercise) => (
                  <li key={exercise.exerciseSlug}>
                    <p className="text-sm font-medium">{exercise.name}</p>
                    {formatGroupedSetSummaries(exercise.sets).map((line) => (
                      <p
                        key={line}
                        className="text-sm text-[var(--muted)] tabular-nums"
                      >
                        {line}
                      </p>
                    ))}
                  </li>
                ))}
              </ul>
            </article>
          ))}
          <Button
            type="button"
            className="w-full"
            disabled={!canImport}
            onClick={() => void handleImport()}
          >
            {importMutation.isPending ? 'Import…' : 'Importer ce programme'}
          </Button>
        </section>
      ) : null}

      {submitError ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {submitError}
        </p>
      ) : null}

      <ButtonLink
        to="/programs"
        variant="ghost"
        className="w-full text-[var(--muted)]"
      >
        Annuler
      </ButtonLink>
    </main>
  );
}
