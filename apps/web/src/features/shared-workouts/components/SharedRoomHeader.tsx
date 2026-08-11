import type { SharedWorkoutRoomStatus } from '@gym-companion/shared';
import { Link } from 'react-router-dom';

import {
  ContextMenu,
  type ContextMenuItem,
} from '@/features/programs/components/ContextMenu';
import { cn } from '@/lib/utils';

import { getSharedWorkoutRoomStatusLabel } from '../lib/shared-workout-labels';

type SharedRoomHeaderProps = {
  name: string;
  status: SharedWorkoutRoomStatus;
  onlineCount?: number | null;
  menuItems: ContextMenuItem[];
};

export function SharedRoomHeader({
  name,
  status,
  onlineCount = null,
  menuItems,
}: SharedRoomHeaderProps) {
  const statusLabel = getSharedWorkoutRoomStatusLabel(status);
  const statusLine =
    status === 'ACTIVE' && onlineCount != null
      ? `${statusLabel} · ${onlineCount} en ligne`
      : statusLabel;

  return (
    <header className="flex flex-col gap-2">
      <Link
        to="/shared-workouts"
        className="inline-flex min-h-11 w-fit items-center text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
      >
        ← Partagées
      </Link>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title truncate">{name}</h1>
          <p
            className={cn(
              'mt-1 text-[0.6875rem] font-semibold tracking-[0.12em] uppercase',
              status === 'CANCELLED'
                ? 'text-[var(--danger)]'
                : status === 'ACTIVE'
                  ? 'text-[var(--foreground)]'
                  : 'text-[var(--muted)]',
            )}
          >
            {statusLine}
          </p>
        </div>
        {menuItems.length > 0 ? (
          <ContextMenu label="Actions de la salle" items={menuItems} />
        ) : null}
      </div>
    </header>
  );
}
