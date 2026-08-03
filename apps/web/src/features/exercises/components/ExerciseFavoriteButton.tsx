import type { ExerciseUserPreference } from '@gym-companion/shared';
import { Star } from 'lucide-react';

import { cn } from '@/lib/utils';

type ExerciseFavoriteButtonProps = {
  preference: ExerciseUserPreference;
  disabled?: boolean;
  pending?: boolean;
  onToggle: () => void;
  className?: string;
};

export function ExerciseFavoriteButton({
  preference,
  disabled = false,
  pending = false,
  onToggle,
  className,
}: ExerciseFavoriteButtonProps) {
  const isFavorite = preference.isFavorite;
  const label = isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris';

  return (
    <button
      type="button"
      className={cn(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-full transition',
        isFavorite
          ? 'text-amber-600 hover:bg-amber-50'
          : 'text-[var(--muted)] hover:bg-slate-100 hover:text-amber-600',
        (disabled || pending) && 'opacity-50',
        className,
      )}
      aria-label={label}
      aria-pressed={isFavorite}
      aria-busy={pending}
      disabled={disabled || pending}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
    >
      <Star
        className={cn('size-5', isFavorite && 'fill-current')}
        aria-hidden="true"
      />
    </button>
  );
}
