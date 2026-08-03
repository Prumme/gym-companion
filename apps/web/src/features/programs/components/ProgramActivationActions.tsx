import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { Button, ButtonLink } from '@/components/ui/button';
import type { ProgramDetail } from '@gym-companion/shared';
import { getApiErrorMessage } from '@/lib/api/client';

import { activeProgramQueryOptions } from '../api/program-query-options';
import {
  useDeactivateProgramMutation,
} from '../hooks/use-program-mutations';
import {
  ActivateProgramDialog,
  DeactivateProgramDialog,
} from './ProgramActivationDialog';

type ProgramActivationActionsProps = {
  program: ProgramDetail;
  onStatus: (message: string) => void;
};

export function ProgramActivationActions({
  program,
  onStatus,
}: ProgramActivationActionsProps) {
  const activeQuery = useQuery(activeProgramQueryOptions());
  const deactivateMutation = useDeactivateProgramMutation();
  const [activateOpen, setActivateOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeProgram = activeQuery.data;
  const isCurrent = program.isCurrent;
  const canActivate = program.permissions.canActivate;
  const canDeactivate = program.permissions.canDeactivate;

  async function handleDeactivate() {
    setError(null);
    try {
      await deactivateMutation.mutateAsync(program.id);
      setDeactivateOpen(false);
      onStatus('Programme courant désactivé.');
    } catch (err) {
      setError(
        getApiErrorMessage(err, 'Impossible de désactiver ce programme.'),
      );
    }
  }

  if (!isCurrent && !canActivate && !canDeactivate) {
    return null;
  }

  return (
    <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-[var(--muted)] uppercase">
        Programme courant
      </h2>

      {isCurrent ? (
        <div className="flex flex-col gap-2">
          <span className="w-fit rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-900">
            Programme courant
          </span>
          <ButtonLink
            to="/planning"
            variant="secondary"
            className="w-full sm:w-auto"
          >
            Voir le planning
          </ButtonLink>
          {canDeactivate ? (
            <>
              <Button
                type="button"
                variant="destructive"
                className="w-full sm:w-auto"
                onClick={() => {
                  setError(null);
                  setDeactivateOpen(true);
                }}
              >
                Désactiver
              </Button>
              <DeactivateProgramDialog
                open={deactivateOpen}
                programName={program.name}
                pending={deactivateMutation.isPending}
                error={error}
                onConfirm={() => void handleDeactivate()}
                onCancel={() => setDeactivateOpen(false)}
              />
            </>
          ) : null}
        </div>
      ) : null}

      {!isCurrent && canActivate ? (
        <>
          <p className="mb-3 text-sm text-[var(--muted)]">
            Active ce programme pour le suivre dans ton planning hebdomadaire.
          </p>
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={() => setActivateOpen(true)}
          >
            Utiliser ce programme
          </Button>
          <ActivateProgramDialog
            open={activateOpen}
            programId={program.id}
            programName={program.name}
            currentProgramId={
              activeProgram && activeProgram.program.id !== program.id
                ? activeProgram.program.id
                : null
            }
            currentProgramName={
              activeProgram && activeProgram.program.id !== program.id
                ? activeProgram.program.name
                : null
            }
            onSuccess={(message) => {
              setActivateOpen(false);
              onStatus(message);
            }}
            onCancel={() => setActivateOpen(false)}
          />
        </>
      ) : null}
    </section>
  );
}
