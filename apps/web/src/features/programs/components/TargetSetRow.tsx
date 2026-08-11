import type { WorkoutTemplateSetTarget } from '@gym-companion/shared';

import { cn } from '@/lib/utils';

import {
  getWorkoutSetTypeLabel,
  getWorkoutSetTypeShortLabel,
} from '../lib/program-labels';
import { formatSetSummaryCompact } from '../lib/template-forms';
import { ContextMenu, type ContextMenuItem } from './ContextMenu';

type TargetSetRowProps = {
  set: WorkoutTemplateSetTarget;
  index: number;
  readOnly?: boolean;
  menuItems?: ContextMenuItem[];
  onActivate?: () => void;
};

export function TargetSetRow({
  set,
  index,
  readOnly = false,
  menuItems = [],
  onActivate,
}: TargetSetRowProps) {
  const compact = formatSetSummaryCompact(set);
  const typeLabel = getWorkoutSetTypeLabel(set.setType);
  const typeShort = getWorkoutSetTypeShortLabel(set.setType);

  return (
    <li className="border-b border-[var(--border)] last:border-b-0">
      <div
        className={cn(
          'flex min-h-11 items-center gap-2 py-1.5',
          onActivate && !readOnly ? 'cursor-pointer' : '',
        )}
      >
        <button
          type="button"
          className={cn(
            'flex min-w-0 flex-1 items-start gap-2 rounded-[var(--radius-control)] px-1 py-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]',
            !onActivate || readOnly ? 'cursor-default' : '',
          )}
          disabled={readOnly || !onActivate}
          onClick={onActivate}
          aria-label={`Série ${index + 1}, ${typeLabel}`}
        >
          <span className="w-4 shrink-0 pt-0.5 text-xs tabular-nums text-[var(--muted)]">
            {index + 1}
          </span>
          <span className="w-[4.25rem] shrink-0 pt-0.5 truncate text-xs font-medium">
            {typeShort}
          </span>
          <span className="min-w-0 flex-1 break-words text-sm leading-snug tabular-nums">
            {compact.primary}
            {compact.secondary ? (
              <span className="text-[var(--muted)]"> · {compact.secondary}</span>
            ) : null}
          </span>
        </button>
        {!readOnly && menuItems.length > 0 ? (
          <ContextMenu
            label={`Actions série ${index + 1}`}
            items={menuItems}
          />
        ) : null}
      </div>
    </li>
  );
}
