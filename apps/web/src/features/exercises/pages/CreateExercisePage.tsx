import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button, ButtonLink } from '@/components/ui/button';
import { LoadingState } from '@/components/common/LoadingState';
import { getApiErrorMessage } from '@/lib/api/client';

import {
  equipmentTypesQueryOptions,
  muscleGroupsQueryOptions,
} from '../api/exercise-query-options';
import { ExerciseForm } from '../components/ExerciseForm';
import { useCreateExerciseMutation } from '../hooks/use-exercise-mutations';
import {
  EMPTY_EXERCISE_FORM_VALUES,
  formValuesToCreatePayload,
  type ExerciseFormValues,
} from '../lib/exercise-form';

export function CreateExercisePage() {
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const muscleGroupsQuery = useQuery(muscleGroupsQueryOptions());
  const equipmentTypesQuery = useQuery(equipmentTypesQueryOptions());
  const createMutation = useCreateExerciseMutation();

  const referencesLoading =
    muscleGroupsQuery.isLoading || equipmentTypesQuery.isLoading;
  const referencesError =
    muscleGroupsQuery.isError || equipmentTypesQuery.isError;
  const muscleGroups = muscleGroupsQuery.data ?? [];
  const equipmentTypes = equipmentTypesQuery.data ?? [];
  const referencesReady =
    !referencesLoading && !referencesError && muscleGroups.length > 0;

  async function handleSubmit(values: ExerciseFormValues) {
    setSubmitError(null);
    try {
      const payload = formValuesToCreatePayload(values);
      const detail = await createMutation.mutateAsync(payload);
      void navigate(`/exercises/${detail.id}`, {
        replace: true,
        state: { flash: 'Exercice créé.' },
      });
    } catch (error) {
      setSubmitError(
        getApiErrorMessage(
          error,
          'Impossible de créer cet exercice. Vérifie les champs et réessaie.',
        ),
      );
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6">
      <div>
        <ButtonLink to="/exercises" variant="ghost" className="mb-3 w-fit gap-2 px-0">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Retour au catalogue
        </ButtonLink>
        <h1 className="text-2xl font-bold tracking-tight">Créer un exercice</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Ajoute un exercice personnel à ton catalogue.
        </p>
      </div>

      {referencesLoading ? (
        <LoadingState label="Chargement des références…" />
      ) : null}

      {referencesError ? (
        <div
          className="rounded-[var(--radius)] border border-red-200 bg-red-50 p-4"
          role="alert"
        >
          <p className="text-sm text-[var(--danger)]">
            {getApiErrorMessage(
              muscleGroupsQuery.error ?? equipmentTypesQuery.error,
              'Impossible de charger les groupes musculaires ou équipements.',
            )}
          </p>
          <Button
            type="button"
            variant="secondary"
            className="mt-3"
            onClick={() => {
              void muscleGroupsQuery.refetch();
              void equipmentTypesQuery.refetch();
            }}
          >
            Réessayer
          </Button>
        </div>
      ) : null}

      {!referencesLoading &&
      !referencesError &&
      muscleGroups.length === 0 ? (
        <div
          className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4"
          role="status"
        >
          <p className="text-sm text-[var(--muted)]">
            Les groupes musculaires sont indisponibles. Impossible de créer un
            exercice pour le moment.
          </p>
        </div>
      ) : null}

      {referencesReady ? (
        <ExerciseForm
          mode="create"
          initialValues={EMPTY_EXERCISE_FORM_VALUES}
          muscleGroups={muscleGroups}
          equipmentTypes={equipmentTypes}
          pending={createMutation.isPending}
          submitError={submitError}
          cancelTo="/exercises"
          onSubmit={handleSubmit}
        />
      ) : null}
    </main>
  );
}
