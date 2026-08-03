import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { Button, ButtonLink } from '@/components/ui/button';
import { LoadingState } from '@/components/common/LoadingState';
import { getApiErrorMessage, type ApiRequestError } from '@/lib/api/client';

import { programDetailQueryOptions } from '../api/program-query-options';
import { ProgramForm } from '../components/ProgramForm';
import { useUpdateProgramMutation } from '../hooks/use-program-mutations';
import {
  detailToProgramFormValues,
  programFormToUpdatePayload,
  type ProgramFormValues,
} from '../lib/program-form';

export function EditProgramPage() {
  const { programId = '' } = useParams();
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const detailQuery = useQuery({
    ...programDetailQueryOptions(programId),
    enabled: Boolean(programId),
  });
  const updateMutation = useUpdateProgramMutation();

  const initialValues = useMemo(
    () => (detailQuery.data ? detailToProgramFormValues(detailQuery.data) : null),
    [detailQuery.data],
  );

  const isArchived =
    detailQuery.data?.status === 'ARCHIVED' ||
    detailQuery.data?.archivedAt != null;

  async function handleSubmit(values: ProgramFormValues) {
    setSubmitError(null);
    try {
      await updateMutation.mutateAsync({
        programId,
        input: programFormToUpdatePayload(values),
      });
      void navigate(`/programs/${programId}`, {
        replace: true,
        state: { flash: 'Informations enregistrées.' },
      });
    } catch (error) {
      setSubmitError(
        getApiErrorMessage(
          error,
          'Impossible d’enregistrer ce programme. Vérifie les champs et réessaie.',
        ),
      );
    }
  }

  if (detailQuery.isLoading) {
    return <LoadingState label="Chargement du programme…" />;
  }

  if (detailQuery.isError || !detailQuery.data || !initialValues) {
    const status = (detailQuery.error as ApiRequestError | undefined)?.status;
    const message =
      status === 404
        ? 'Ce programme est introuvable ou inaccessible.'
        : getApiErrorMessage(
            detailQuery.error,
            'Impossible de charger ce programme.',
          );

    return (
      <main className="flex flex-1 flex-col gap-4">
        <ButtonLink to="/programs" variant="ghost" className="w-fit gap-2 px-0">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Retour aux programmes
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

  if (isArchived || !detailQuery.data.permissions.canEdit) {
    return (
      <main className="flex flex-1 flex-col gap-4">
        <ButtonLink
          to={`/programs/${programId}`}
          variant="ghost"
          className="w-fit gap-2 px-0"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Retour au programme
        </ButtonLink>
        <div
          className="rounded-[var(--radius)] border border-amber-200 bg-amber-50 p-4"
          role="status"
        >
          <p className="text-sm text-amber-950">
            Ce programme est archivé ou non modifiable. Restaure-le pour éditer
            ses informations.
          </p>
          <Button
            type="button"
            variant="secondary"
            className="mt-3"
            onClick={() => void navigate(`/programs/${programId}`)}
          >
            Voir le programme
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6">
      <div>
        <ButtonLink
          to={`/programs/${programId}`}
          variant="ghost"
          className="mb-3 w-fit gap-2 px-0"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Retour au programme
        </ButtonLink>
        <h1 className="text-2xl font-bold tracking-tight">
          Modifier les informations
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Nom, description et objectif du programme.
        </p>
      </div>

      <ProgramForm
        mode="edit"
        initialValues={initialValues}
        pending={updateMutation.isPending}
        submitError={submitError}
        cancelTo={`/programs/${programId}`}
        submitLabel="Enregistrer"
        onSubmit={handleSubmit}
      />
    </main>
  );
}
