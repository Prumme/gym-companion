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
};

export function WorkoutSyncBanner({
  label,
  status,
  pendingCount,
  browserOffline,
  fromLocalSnapshot = false,
  onSyncNow,
  syncDisabled = false,
}: WorkoutSyncBannerProps) {
  const showSync =
    pendingCount > 0 &&
    status !== 'CONFLICT' &&
    status !== 'SYNCING' &&
    !browserOffline &&
    onSyncNow;

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
