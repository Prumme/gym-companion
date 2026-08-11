import type { ExerciseSource } from '@gym-companion/shared';

import { cn } from '@/lib/utils';

type ExerciseSourceBadgeProps = {
  source: ExerciseSource;
  className?: string;
};

/** Badge discret pour les exercices personnels uniquement (pas de badge SYSTEM). */
export function ExerciseSourceBadge({
  source,
  className,
}: ExerciseSourceBadgeProps) {
  if (source !== 'USER') {
    return null;
  }

  return (
    <span
      className={cn(
        'inline-flex text-[0.625rem] font-semibold tracking-wide text-[var(--muted-foreground)] uppercase',
        className,
      )}
    >
      Personnel
    </span>
  );
}
