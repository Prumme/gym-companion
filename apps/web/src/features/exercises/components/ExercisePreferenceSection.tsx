import type { ExerciseDetail } from '@gym-companion/shared';
import { useEffect, useId, useRef, useState } from 'react';
import type { UpdateExercisePreferenceInput } from '@gym-companion/validation';

import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api/client';

import {
  useResetExercisePreferenceMutation,
  useUpdateExercisePreferenceMutation,
} from '../hooks/use-exercise-preference-mutations';
import {
  hasCustomExercisePreference,
} from '../lib/exercise-preference';
import { ExercisePreferenceForm } from './ExercisePreferenceForm';

type ExercisePreferenceSectionProps = {
  exercise: ExerciseDetail;
};

export function ExercisePreferenceSection({ exercise }: ExercisePreferenceSectionProps) {
  const preference = exercise.userPreference;
  const [editorOpen, setEditorOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const updateMutation = useUpdateExercisePreferenceMutation();
  const resetMutation = useResetExercisePreferenceMutation();

  const preferenceBusy =
    (updateMutation.isPending &&
      updateMutation.variables?.exerciseId === exercise.id) ||
    (resetMutation.isPending && resetMutation.variables === exercise.id);

  const custom = hasCustomExercisePreference(preference);

  useEffect(() => {
    if (!editorOpen) {
      return;
    }
    const node = dialogRef.current;
    const focusable = node?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setEditorOpen(false);
        setSubmitError(null);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [editorOpen]);

  async function handleSave(payload: UpdateExercisePreferenceInput) {
    setSubmitError(null);
    setStatusMessage(null);
    try {
      const optimisticPreference = {
        isFavorite: payload.isFavorite,
        isExcludedFromSuggestions: payload.isExcludedFromSuggestions,
        preferredEquipmentType:
          payload.preferredEquipmentTypeId === null
            ? null
            : (exercise.compatibleEquipmentTypes.find(
                (item) => item.equipmentType.id === payload.preferredEquipmentTypeId,
              )?.equipmentType ??
              preference.preferredEquipmentType),
        restSecondsOverride: payload.restSecondsOverride,
      };
      await updateMutation.mutateAsync({
        exerciseId: exercise.id,
        input: payload,
        optimisticPreference,
      });
      setEditorOpen(false);
      setStatusMessage('Préférences enregistrées.');
    } catch (error) {
      setSubmitError(
        getApiErrorMessage(
          error,
          'Impossible d’enregistrer les préférences. Réessaie.',
        ),
      );
    }
  }

  async function handleReset() {
    setSubmitError(null);
    setStatusMessage(null);
    try {
      await resetMutation.mutateAsync(exercise.id);
      setConfirmReset(false);
      setEditorOpen(false);
      setStatusMessage('Préférences réinitialisées.');
    } catch (error) {
      setSubmitError(
        getApiErrorMessage(
          error,
          'Impossible de réinitialiser les préférences. Réessaie.',
        ),
      );
    }
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="section-title">Préférences</h2>
        <Button
          type="button"
          variant="secondary"
          className="px-3"
          disabled={preferenceBusy}
          onClick={() => {
            setSubmitError(null);
            setEditorOpen(true);
          }}
        >
          Modifier mes préférences
        </Button>
      </div>

      <ul className="flex flex-col text-sm">
        <li className="flex min-h-11 items-center justify-between gap-3 border-b border-[var(--border)] py-2">
          <span className="text-[var(--muted-foreground)]">Suggestions</span>
          <span className="font-medium">
            {preference.isExcludedFromSuggestions ? 'Exclues' : 'Autorisées'}
          </span>
        </li>
        <li className="flex min-h-11 items-center justify-between gap-3 border-b border-[var(--border)] py-2">
          <span className="text-[var(--muted-foreground)]">Équipement préféré</span>
          <span className="max-w-[55%] truncate text-right font-medium">
            {preference.preferredEquipmentType?.name ?? 'Aucun'}
          </span>
        </li>
        <li className="flex min-h-11 items-center justify-between gap-3 border-b border-[var(--border)] py-2">
          <span className="text-[var(--muted-foreground)]">Repos personnel</span>
          <span className="font-medium">
            {preference.restSecondsOverride != null
              ? `${preference.restSecondsOverride} s`
              : 'Par défaut'}
          </span>
        </li>
      </ul>

      {custom ? (
        <button
          type="button"
          className="mt-3 min-h-11 text-sm text-[var(--muted-foreground)] underline-offset-2 hover:underline disabled:opacity-50"
          disabled={preferenceBusy}
          onClick={() => setConfirmReset(true)}
        >
          Réinitialiser les préférences
        </button>
      ) : null}

      {statusMessage ? (
        <p className="mt-2 text-sm text-[var(--foreground)]" role="status">
          {statusMessage}
        </p>
      ) : null}
      {submitError && !editorOpen ? (
        <p className="mt-2 text-sm text-[var(--danger)]" role="alert">
          {submitError}
        </p>
      ) : null}

      {editorOpen ? (
        <div
          className="fixed inset-0 z-40 bg-[var(--foreground)]/40"
          role="presentation"
          onClick={() => {
            if (!preferenceBusy) {
              setEditorOpen(false);
              setSubmitError(null);
            }
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="absolute inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto rounded-t-[var(--radius-surface)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg md:inset-auto md:top-1/2 md:left-1/2 md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[var(--radius-surface)]"
            style={{
              paddingBottom:
                'calc(var(--space-6) + env(safe-area-inset-bottom, 0px))',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id={titleId} className="mb-1 text-lg font-semibold">
              Préférences
            </h3>
            <p className="mb-4 text-sm text-[var(--muted-foreground)]">
              {exercise.name}
            </p>
            <ExercisePreferenceForm
              preference={preference}
              compatibleEquipment={exercise.compatibleEquipmentTypes}
              pending={preferenceBusy}
              submitError={submitError}
              onCancel={() => {
                setEditorOpen(false);
                setSubmitError(null);
              }}
              onSubmit={handleSave}
            />
          </div>
        </div>
      ) : null}

      {confirmReset ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--foreground)]/40 p-4 md:items-center"
          role="presentation"
          onClick={() => {
            if (!preferenceBusy) {
              setConfirmReset(false);
            }
          }}
        >
          <div
            role="alertdialog"
            aria-labelledby="reset-pref-title"
            aria-describedby="reset-pref-desc"
            className="w-full max-w-md rounded-[var(--radius-surface)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="reset-pref-title" className="text-lg font-semibold">
              Réinitialiser tes préférences pour cet exercice ?
            </h3>
            <p id="reset-pref-desc" className="mt-2 text-sm text-[var(--muted-foreground)]">
              Le favori sera retiré, l’équipement préféré et le repos personnel seront
              supprimés. L’exercice ne sera pas supprimé.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                className="flex-1"
                disabled={preferenceBusy}
                onClick={() => {
                  void handleReset();
                }}
              >
                {preferenceBusy ? 'Réinitialisation…' : 'Réinitialiser'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                disabled={preferenceBusy}
                onClick={() => setConfirmReset(false)}
              >
                Annuler
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
