import { Share2 } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/lib/utils';

import { useCreateExerciseShareMutation } from '../hooks/use-training-share-mutations';
import { getTrainingShareErrorMessage } from '../lib/share-format';
import { ShareLinkSheet } from './ShareLinkSheet';

type ExerciseShareButtonProps = {
  exerciseId: string;
  className?: string;
};

/** Bouton icône + sheet de lien pour partager un exercice personnel. */
export function ExerciseShareButton({ exerciseId, className }: ExerciseShareButtonProps) {
  const shareMutation = useCreateExerciseShareMutation();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleShare() {
    setOpen(true);
    setToken(null);
    setExpiresAt(null);
    setError(null);
    try {
      const result = await shareMutation.mutateAsync(exerciseId);
      setToken(result.token);
      setExpiresAt(result.expiresAt);
    } catch (err) {
      setError(getTrainingShareErrorMessage(err, 'Impossible de partager cet exercice.'));
    }
  }

  return (
    <>
      <button
        type="button"
        className={cn(
          'inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-[var(--muted-foreground)] transition hover:text-[var(--foreground)]',
          shareMutation.isPending && 'opacity-50',
          className,
        )}
        aria-label="Partager l’exercice"
        aria-busy={shareMutation.isPending}
        disabled={shareMutation.isPending}
        onClick={() => {
          void handleShare();
        }}
      >
        <Share2 className="size-5" aria-hidden="true" />
      </button>
      <ShareLinkSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Partager l’exercice"
        token={token}
        expiresAt={expiresAt}
        loading={shareMutation.isPending && !token && !error}
        error={error}
      />
    </>
  );
}
