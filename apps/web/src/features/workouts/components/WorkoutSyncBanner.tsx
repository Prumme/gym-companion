import { Button } from '@/components/ui/button';

import type { WorkoutSyncStatus } from '../offline/types';

type WorkoutSyncBannerProps = {
  label: string;
  status: WorkoutSyncStatus;
  pendingCount: number;
  browserOffline: boolean;
  fromLocalSnapshot?: boolean;
  onSyncNow?: () => void;
  syncDisabled?: boolean;
  compact?: boolean;
};

export function WorkoutSyncBanner({
  label,
  status,
  pendingCount,
  browserOffline,
  fromLocalSnapshot = false,
  onSyncNow,
  syncDisabled = false,
  compact = false,
}: WorkoutSyncBannerProps) {
  const showSync =
    pendingCount > 0 &&
    status !== 'CONFLICT' &&
    status !== 'SYNCING' &&
    !browserOffline &&
    onSyncNow;

  if (compact) {
    return (
      <div
        className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]"
        role="status"
      >
        <p>
          {browserOffline
            ? 'Hors ligne'
            : status === 'SYNCING'
              ? 'Synchronisation…'
              : label}
          {fromLocalSnapshot ? ' · Local' : ''}
          {pendingCount > 0 ? ` · ${pendingCount} en attente` : ''}
        </p>
        {showSync ? (
          <button
            type="button"
            className="min-h-9 font-medium text-[var(--foreground)] underline-offset-2 hover:underline disabled:opacity-50"
            disabled={syncDisabled}
            onClick={onSyncNow}
          >
            Synchroniser
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
      role="status"
    >
      <p className="font-medium">{label}</p>
      {fromLocalSnapshot ? (
        <p className="mt-1 text-[var(--muted)]">
          Données chargées depuis le stockage local.
        </p>
      ) : null}
      {status === 'PENDING' || status === 'OFFLINE' ? (
        <p className="mt-1 text-[var(--muted)]">
          Les modifications ne sont pas encore confirmées par le serveur.
        </p>
      ) : null}
      {showSync ? (
        <Button
          type="button"
          variant="secondary"
          className="mt-2"
          disabled={syncDisabled}
          onClick={onSyncNow}
        >
          Synchroniser maintenant
        </Button>
      ) : null}
    </div>
  );
}
