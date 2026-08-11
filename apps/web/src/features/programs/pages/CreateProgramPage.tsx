import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

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
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5">
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
            Créer un programme
          </h1>
        </div>
      </header>

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
