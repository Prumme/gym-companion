import type { AiCoachProposalSummary } from '@gym-companion/shared';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getApiErrorMessage } from '@/lib/api/client';

import {
  useAcceptAiCoachProposalMutation,
  useDismissAiCoachProposalMutation,
} from '../hooks/use-coach-proposal-mutations';
import {
  getProposalKindLabel,
  getProposalStatusLabel,
} from '../lib/proposal-labels';
import { CoachProposalPreviewSheet } from './CoachProposalPreviewSheet';
import { CoachProposalProgramPickerSheet } from './CoachProposalProgramPickerSheet';

type CoachProposalCardProps = {
  proposal: AiCoachProposalSummary;
  conversationId: string;
};

function proposalTitle(proposal: AiCoachProposalSummary): string {
  return proposal.preview.kind === 'PROGRAM'
    ? proposal.preview.program.name
    : proposal.preview.workout.name;
}

function proposalSubtitle(proposal: AiCoachProposalSummary): string {
  if (proposal.preview.kind === 'PROGRAM') {
    const count = proposal.preview.program.workouts.length;
    return `${count} séance${count > 1 ? 's' : ''}`;
  }
  const count = proposal.preview.workout.exercises.length;
  return `${count} exercice${count > 1 ? 's' : ''}`;
}

/**
 * Jalon 8 — l’IA ne crée jamais directement une ressource : elle propose, et
 * seule une action explicite de l’utilisateur (Accepter) déclenche une
 * création déterministe côté serveur (`AiCoachProposalService`). Cette carte
 * n’affiche jamais le JSON brut de la proposition.
 */
export function CoachProposalCard({
  proposal,
  conversationId,
}: CoachProposalCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const acceptMutation = useAcceptAiCoachProposalMutation(conversationId);
  const dismissMutation = useDismissAiCoachProposalMutation(conversationId);

  const isPending = proposal.status === 'PENDING';
  const isAccepted = proposal.status === 'ACCEPTED';
  const isDismissed = proposal.status === 'DISMISSED';
  const isInvalid = proposal.status === 'INVALID';

  function acceptDirectly() {
    acceptMutation.mutate({ proposalId: proposal.id });
  }

  function handleAcceptClick() {
    if (proposal.kind === 'WORKOUT') {
      setPickerOpen(true);
      return;
    }
    acceptDirectly();
  }

  function handleConfirmProgram(programId: string) {
    acceptMutation.mutate(
      { proposalId: proposal.id, programId },
      {
        onSuccess: () => setPickerOpen(false),
      },
    );
  }

  return (
    <Card
      as="article"
      className="flex flex-col gap-3"
      aria-label={getProposalKindLabel(proposal.kind)}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
            {getProposalKindLabel(proposal.kind)}
          </p>
          <p className="mt-0.5 text-sm font-semibold">
            {proposalTitle(proposal)}
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">
            {proposalSubtitle(proposal)}
          </p>
        </div>
        <ProposalStatusBadge status={proposal.status} />
      </div>

      <Button
        type="button"
        variant="secondary"
        className="min-h-10 w-fit"
        onClick={() => setDetailOpen(true)}
      >
        Voir le détail
      </Button>

      {isInvalid ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          Cette proposition n’est plus valide (un élément référencé a changé
          depuis, par exemple un exercice archivé). Demande une nouvelle
          proposition au Coach.
        </p>
      ) : null}

      {isDismissed ? (
        <p className="text-sm text-[var(--muted-foreground)]">
          Tu as refusé cette proposition.
        </p>
      ) : null}

      {isAccepted ? (
        <p className="text-sm text-[var(--muted-foreground)]">
          Tu as créé{' '}
          {proposal.kind === 'PROGRAM'
            ? 'ce programme'
            : 'cette séance'}
          {proposal.createdProgramId ? (
            <>
              {' '}
              —{' '}
              <Link
                to={`/programs/${proposal.createdProgramId}`}
                className="font-medium underline-offset-2 hover:underline"
              >
                l’ouvrir
              </Link>
            </>
          ) : null}
          .
        </p>
      ) : null}

      {isPending ? (
        <div className="flex flex-col gap-2">
          {acceptMutation.isError ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {getApiErrorMessage(
                acceptMutation.error,
                'Impossible d’accepter cette proposition.',
              )}
            </p>
          ) : null}
          {dismissMutation.isError ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {getApiErrorMessage(
                dismissMutation.error,
                'Impossible de refuser cette proposition.',
              )}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="button"
              className="min-h-10"
              disabled={acceptMutation.isPending || dismissMutation.isPending}
              aria-busy={acceptMutation.isPending}
              onClick={handleAcceptClick}
            >
              {acceptMutation.isPending ? 'Ajout en cours…' : 'Accepter'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="min-h-10"
              disabled={acceptMutation.isPending || dismissMutation.isPending}
              aria-busy={dismissMutation.isPending}
              onClick={() => dismissMutation.mutate(proposal.id)}
            >
              Refuser
            </Button>
          </div>
        </div>
      ) : null}

      <CoachProposalPreviewSheet
        open={detailOpen}
        title={proposalTitle(proposal)}
        preview={proposal.preview}
        onClose={() => setDetailOpen(false)}
      />

      {proposal.kind === 'WORKOUT' ? (
        <CoachProposalProgramPickerSheet
          open={pickerOpen}
          pending={acceptMutation.isPending}
          error={
            acceptMutation.isError
              ? getApiErrorMessage(
                  acceptMutation.error,
                  'Impossible d’accepter cette proposition.',
                )
              : null
          }
          onClose={() => setPickerOpen(false)}
          onConfirm={handleConfirmProgram}
        />
      ) : null}
    </Card>
  );
}

function ProposalStatusBadge({
  status,
}: {
  status: AiCoachProposalSummary['status'];
}) {
  const label = getProposalStatusLabel(status);
  const toneClass =
    status === 'ACCEPTED'
      ? 'border-[var(--border)] text-[var(--foreground)]'
      : status === 'INVALID'
        ? 'border-[var(--danger)]/30 text-[var(--danger)]'
        : 'border-[var(--border)] text-[var(--muted-foreground)]';
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}
    >
      {label}
    </span>
  );
}
