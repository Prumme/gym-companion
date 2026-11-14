import type { ExerciseMedia } from '@gym-companion/shared';
import { Eye } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

import { ExerciseMediaSheet } from './ExerciseMediaSheet';

type ExerciseMediaButtonProps = {
  exerciseName: string;
  media: ExerciseMedia | null;
  className?: string;
};

/** Icône « œil » ouvrant la démonstration ; rien n’est rendu sans média. */
export function ExerciseMediaButton({ exerciseName, media, className }: ExerciseMediaButtonProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleClose = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  if (!media || media.frames.length === 0) {
    return null;
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`Voir la démonstration de ${exerciseName}`}
        title="Voir la démonstration"
        className={cn(
          'inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-[var(--muted-foreground)] hover:bg-[var(--background)] hover:text-[var(--foreground)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]',
          className,
        )}
      >
        <Eye className="size-5" aria-hidden="true" />
      </button>
      <ExerciseMediaSheet
        open={open}
        onClose={handleClose}
        exerciseName={exerciseName}
        media={media}
      />
    </>
  );
}
