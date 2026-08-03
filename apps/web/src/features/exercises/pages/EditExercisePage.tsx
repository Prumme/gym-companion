import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { Button, ButtonLink } from '@/components/ui/button';
import { LoadingState } from '@/components/common/LoadingState';
import { getApiErrorMessage, type ApiRequestError } from '@/lib/api/client';

import {
  equipmentTypesQueryOptions,
  exerciseDetailQueryOptions,
  muscleGroupsQueryOptions,
} from '../api/exercise-query-options';
import { ExerciseForm } from '../components/ExerciseForm';
import { useUpdateExerciseMutation } from '../hooks/use-exercise-mutations';
import {
  canEditExercise,
  detailToFormValues,
  formValuesToUpdatePayload,
  type ExerciseFormValues,
} from '../lib/exercise-form';

export function EditExercisePage() {
  const { exerciseId = '' } = useParams();
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const detailQuery = useQuery({
    ...exerciseDetailQueryOptions(exerciseId),
    enabled: Boolean(exerciseId),
  });
  const muscleGroupsQuery = useQuery(muscleGroupsQueryOptions());
  const equipmentTypesQuery = useQuery(equipmentTypesQueryOptions());
  const updateMutation = useUpdateExerciseMutation();

  const initialValues = useMemo(
    () => (detailQuery.data ? detailToFormValues(detailQuery.data) : null),
    [detailQuery.data],
  );

  const referencesLoading =
    muscleGroupsQuery.isLoading || equipmentTypesQuery.isLoading;
  const referencesError =
    muscleGroupsQuery.isError || equipmentTypesQuery.isError;
  const muscleGroups = muscleGroupsQuery.data ?? [];
  const equipmentTypes = equipmentTypesQuery.data ?? [];

  async function handleSubmit(values: ExerciseFormValues) {
    setSubmitError(null);
    setStatusMessage(null);
    try {
      const payload = formValuesToUpdatePayload(values);
      await updateMutation.mutateAsync({ exerciseId, input: payload });
      setStatusMessage('Exercice enregistré.');
      void navigate(`/exercises/${exerciseId}`, {
        replace: true,
        state: { flash: 'Exercice enregistré.' },
      });
    } catch (error) {
      setSubmitError(
        getApiErrorMessage(
          error,
          'Impossible d’enregistrer cet exercice. Vérifie les champs et réessaie.',
        ),
      );
    }
  }

  if (detailQuery.isLoading) {
    return <LoadingState label="Chargement de l’exercice…" />;
  }

  if (detailQuery.isError || !detailQuery.data) {
    const status = (detailQuery.error as ApiRequestError | undefined)?.status;
    const message =
      status === 404
        ? 'Cet exercice est introuvable ou inaccessible.'
        : getApiErrorMessage(
            detailQuery.error,
            'Impossible de charger cet exercice.',
          );

    return (
      <main className="flex flex-1 flex-col gap-4">
        <ButtonLink to="/exercises" variant="ghost" className="w-fit gap-2 px-0">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Retour au catalogue
        </ButtonLink>
        <div
          className="rounded-[var(--radius)] border border-red-200 bg-red-50 p-4"
          role="alert"
        >
          <p className="text-sm text-[var(--danger)]">{message}</p>
        </div>
      </main>
    );
  }

  const exercise = detailQuery.data;
  const detailPath = `/exercises/${exercise.id}`;

  if (exercise.archivedAt) {
    return (
      <main className="flex flex-1 flex-col gap-4">
        <ButtonLink to={detailPath} variant="ghost" className="w-fit gap-2 px-0">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Retour au détail
        </ButtonLink>
        <h1 className="text-2xl font-bold tracking-tight">Exercice archivé</h1>
        <p className="text-sm text-[var(--muted)]">
          Cet exercice est archivé et ne peut pas être modifié. Restaure-le depuis
          sa fiche détail si tu veux le modifier.
        </p>
        <ButtonLink to={detailPath} variant="secondary" className="w-fit">
          Voir le détail
        </ButtonLink>
      </main>
    );
  }

  if (!canEditExercise(exercise.permissions)) {
    return (
      <main className="flex flex-1 flex-col gap-4">
        <ButtonLink to={detailPath} variant="ghost" className="w-fit gap-2 px-0">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Retour au détail
        </ButtonLink>
        <h1 className="text-2xl font-bold tracking-tight">Modification indisponible</h1>
        <p className="text-sm text-[var(--muted)]">
          Tu ne peux pas modifier cet exercice. Les exercices système restent en
          lecture seule.
        </p>
        <div className="flex flex-wrap gap-2">
          <ButtonLink to={detailPath} variant="secondary">
            Voir le détail
          </ButtonLink>
          <ButtonLink to="/exercises" variant="ghost">
            Catalogue
          </ButtonLink>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6">
      <div>
        <ButtonLink to={detailPath} variant="ghost" className="mb-3 w-fit gap-2 px-0">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Retour au détail
        </ButtonLink>
        <h1 className="text-2xl font-bold tracking-tight">Modifier l’exercice</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{exercise.name}</p>
      </div>

      {statusMessage ? (
        <p className="text-sm text-emerald-700" role="status">
          {statusMessage}
        </p>
      ) : null}

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
      initialValues &&
      muscleGroups.length > 0 ? (
        <ExerciseForm
          mode="edit"
          initialValues={initialValues}
          muscleGroups={muscleGroups}
          equipmentTypes={equipmentTypes}
          pending={updateMutation.isPending}
          submitError={submitError}
          cancelTo={detailPath}
          onSubmit={handleSubmit}
        />
      ) : null}
    </main>
  );
}
