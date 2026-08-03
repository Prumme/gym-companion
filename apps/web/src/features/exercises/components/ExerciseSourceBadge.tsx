import type { ExerciseSource } from '@gym-companion/shared';

import { getSourceLabel } from '../lib/exercise-labels';
import { cn } from '@/lib/utils';

type ExerciseSourceBadgeProps = {
  source: ExerciseSource;
  className?: string;
};

export function ExerciseSourceBadge({ source, className }: ExerciseSourceBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
        source === 'SYSTEM'
          ? 'bg-sky-50 text-sky-800'
          : 'bg-amber-50 text-amber-900',
        className,
      )}
    >
      {getSourceLabel(source)}
    </span>
  );
}
