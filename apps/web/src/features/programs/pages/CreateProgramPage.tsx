import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ButtonLink } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api/client';

import { ProgramForm } from '../components/ProgramForm';
import { useCreateProgramMutation } from '../hooks/use-program-mutations';
import {
  EMPTY_PROGRAM_FORM_VALUES,
  programFormToCreatePayload,
  type ProgramFormValues,
} from '../lib/program-form';

export function CreateProgramPage() {
  const navigate = useNavigate();
  const createMutation = useCreateProgramMutation();
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(values: ProgramFormValues) {
    setSubmitError(null);
    try {
      const detail = await createMutation.mutateAsync(
        programFormToCreatePayload(values),
      );
      void navigate(`/programs/${detail.id}`, {
        replace: true,
        state: { flash: 'Programme créé.' },
      });
    } catch (error) {
      setSubmitError(
        getApiErrorMessage(
          error,
          'Impossible de créer ce programme. Vérifie les champs et réessaie.',
        ),
      );
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6">
      <div>
        <ButtonLink to="/programs" variant="ghost" className="mb-3 w-fit gap-2 px-0">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Retour aux programmes
        </ButtonLink>
        <h1 className="text-2xl font-bold tracking-tight">Créer un programme</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Commence par les informations générales. Tu pourras ajouter des séances
          ensuite.
        </p>
      </div>

      <ProgramForm
        mode="create"
        initialValues={EMPTY_PROGRAM_FORM_VALUES}
        pending={createMutation.isPending}
        submitError={submitError}
        cancelTo="/programs"
        submitLabel="Créer le programme"
        onSubmit={handleSubmit}
      />
    </main>
  );
}
