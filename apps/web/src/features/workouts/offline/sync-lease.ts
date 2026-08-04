import { OFFLINE_TAB_ID } from './command-id';
import type { SyncLease, StoredWorkoutSyncState } from './types';

export const SYNC_LEASE_TTL_MS = 15_000;

export function tryAcquireLease(
  state: StoredWorkoutSyncState | null,
  nowMs: number = Date.now(),
  ttlMs: number = SYNC_LEASE_TTL_MS,
): SyncLease | null {
  const current = state?.lease;
  if (
    current &&
    current.expiresAt > nowMs &&
    current.ownerTabId !== OFFLINE_TAB_ID
  ) {
    return null;
  }
  return {
    ownerTabId: OFFLINE_TAB_ID,
    acquiredAt: nowMs,
    expiresAt: nowMs + ttlMs,
  };
}

export function isLeaseHeldByThisTab(
  lease: SyncLease | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  return Boolean(
    lease && lease.ownerTabId === OFFLINE_TAB_ID && lease.expiresAt > nowMs,
  );
}

export function refreshLease(
  lease: SyncLease,
  nowMs: number = Date.now(),
  ttlMs: number = SYNC_LEASE_TTL_MS,
): SyncLease {
  return {
    ...lease,
    expiresAt: nowMs + ttlMs,
  };
}
