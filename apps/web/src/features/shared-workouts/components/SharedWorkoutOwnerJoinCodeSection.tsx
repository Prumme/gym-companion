import { Copy, RefreshCw, Share2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/features/programs/components/ConfirmDialog';
import { getApiErrorMessage } from '@/lib/api/client';

import { useRotateSharedWorkoutJoinCodeMutation } from '../hooks/use-shared-workout-mutations';

type SharedWorkoutOwnerJoinCodeSectionProps = {
  roomId: string;
  joinCode: string;
  offline: boolean;
};

export function SharedWorkoutOwnerJoinCodeSection({
  roomId,
  joinCode,
  offline,
}: SharedWorkoutOwnerJoinCodeSectionProps) {
  const rotateMutation = useRotateSharedWorkoutJoinCodeMutation(roomId);
  const [displayCode, setDisplayCode] = useState(joinCode);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);

  useEffect(() => {
    setDisplayCode(joinCode);
  }, [joinCode]);

  useEffect(() => {
    if (!copyFeedback) return;
    const timer = window.setTimeout(() => setCopyFeedback(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copyFeedback]);

  const canShare =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function';

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(displayCode);
      setCopyFeedback(true);
    } catch {
      setCopyFeedback(false);
    }
  }

  async function shareCode() {
    const message = `Rejoins ma séance Gym Companion avec le code ${displayCode}`;
    if (canShare) {
      try {
        await navigator.share({ text: message });
        return;
      } catch {
        // Annulation ou indisponibilité — repli sur copie.
      }
    }
    await copyCode();
  }

  async function handleRotateConfirm() {
    setRotateError(null);
    try {
      const result = await rotateMutation.mutateAsync();
      setDisplayCode(result.joinCode);
      setRotateOpen(false);
    } catch (error) {
      setRotateError(
        getApiErrorMessage(error, 'Impossible de régénérer le code.'),
      );
    }
  }

  return (
    <section
      aria-labelledby="shared-join-code-heading"
      className="rounded-[var(--radius-surface)] border border-[var(--border)] bg-[var(--surface)] p-4"
    >
      <h2
        id="shared-join-code-heading"
        className="text-xs font-semibold tracking-[0.12em] text-[var(--muted)] uppercase"
      >
        Code d’accès
      </h2>
      <p
        className="mt-2 font-mono text-2xl tracking-[0.15em] text-[var(--foreground)]"
        aria-label={`Code d’accès ${displayCode}`}
      >
        {displayCode}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={offline}
          className="gap-2"
          onClick={() => void copyCode()}
        >
          <Copy className="size-4" aria-hidden="true" />
          {copyFeedback ? 'Code copié' : 'Copier'}
        </Button>
        {canShare ? (
          <Button
            type="button"
            variant="secondary"
            disabled={offline}
            className="gap-2"
            onClick={() => void shareCode()}
          >
            <Share2 className="size-4" aria-hidden="true" />
            Partager
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          disabled={offline || rotateMutation.isPending}
          className="gap-2"
          onClick={() => {
            setRotateError(null);
            setRotateOpen(true);
          }}
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Régénérer
        </Button>
      </div>

      <ConfirmDialog
        open={rotateOpen}
        title="Régénérer le code ?"
        description="L’ancien code ne permettra plus de rejoindre la salle. Les membres déjà présents resteront dans la salle."
        confirmLabel="Régénérer"
        pending={rotateMutation.isPending}
        error={rotateError}
        onConfirm={() => void handleRotateConfirm()}
        onCancel={() => {
          if (!rotateMutation.isPending) setRotateOpen(false);
        }}
      />
    </section>
  );
}
