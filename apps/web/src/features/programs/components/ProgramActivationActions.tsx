import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import type { ProgramDetail } from '@gym-companion/shared';

import { activeProgramQueryOptions } from '../api/program-query-options';
import { ActivateProgramDialog } from './ProgramActivationDialog';

type ProgramActivationActionsProps = {
  program: ProgramDetail;
  onStatus: (message: string) => void;
};

/**
 * Activation only (non-current programs).
 * Current state is shown via the header ACTIF badge;
 * deactivate lives in the program `…` menu.
 */
export function ProgramActivationActions({
  program,
  onStatus,
}: ProgramActivationActionsProps) {
  const activeQuery = useQuery(activeProgramQueryOptions());
  const [activateOpen, setActivateOpen] = useState(false);

  const activeProgram = activeQuery.data;
  const isCurrent = program.isCurrent;
  const canActivate = program.permissions.canActivate;

  if (isCurrent || !canActivate) {
    return null;
  }

  return (
    <section className="space-y-2">
      <p className="text-sm text-[var(--muted)]">
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
    </section>
  );
}
