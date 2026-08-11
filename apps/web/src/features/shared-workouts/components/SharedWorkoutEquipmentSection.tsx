import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api/client';

import {
  mySharedEquipmentQueryOptions,
  sharedWorkoutEquipmentCoordinationQueryOptions,
} from '../api/shared-workout-query-options';
import {
  useCancelSharedEquipmentWaitingMutation,
  useReleaseSharedEquipmentMutation,
  useRequestSharedEquipmentMutation,
} from '../hooks/use-shared-equipment-mutations';

function createClientCommandId(): string {
  return crypto.randomUUID();
}

type Props = {
  roomId: string;
  offline: boolean;
  enabled: boolean;
};

/**
 * Coordination matériel — labels humains (pas de jargon FIFO/SQL).
 */
export function SharedWorkoutEquipmentSection({
  roomId,
  offline,
  enabled,
}: Props) {
  const coordinationQuery = useQuery({
    ...sharedWorkoutEquipmentCoordinationQueryOptions(roomId),
    enabled,
  });
  const myQuery = useQuery({
    ...mySharedEquipmentQueryOptions(roomId),
    enabled,
  });
  const requestMutation = useRequestSharedEquipmentMutation(roomId);
  const releaseMutation = useReleaseSharedEquipmentMutation(roomId);
  const cancelMutation = useCancelSharedEquipmentWaitingMutation(roomId);
  const [localError, setLocalError] = useState<string | null>(null);
  const [promotedNotice, setPromotedNotice] = useState(false);
  const prevState = useRef<string | null>(null);

  const my = myQuery.data;
  useEffect(() => {
    if (!my || my.state === 'NONE') {
      prevState.current = my?.state ?? null;
      return;
    }
    if (prevState.current === 'WAITING' && my.state === 'USING') {
      setPromotedNotice(true);
    }
    prevState.current = my.state;
  }, [my]);

  if (!enabled) return null;

  const busy =
    requestMutation.isPending ||
    releaseMutation.isPending ||
    cancelMutation.isPending;

  async function onRequest() {
    setLocalError(null);
    try {
      await requestMutation.mutateAsync(createClientCommandId());
    } catch (error) {
      setLocalError(
        getApiErrorMessage(error, 'Impossible de demander l’équipement.'),
      );
    }
  }

  async function onRelease() {
    setLocalError(null);
    try {
      await releaseMutation.mutateAsync(createClientCommandId());
      setPromotedNotice(false);
    } catch (error) {
      setLocalError(
        getApiErrorMessage(error, 'Impossible de libérer l’équipement.'),
      );
    }
  }

  async function onCancel() {
    setLocalError(null);
    try {
      await cancelMutation.mutateAsync(createClientCommandId());
    } catch (error) {
      setLocalError(
        getApiErrorMessage(error, 'Impossible de quitter la file.'),
      );
    }
  }

  const equipmentList = coordinationQuery.data?.equipment ?? [];

  return (
    <section aria-labelledby="equipment-heading" className="flex flex-col gap-3">
      <h2
        id="equipment-heading"
        className="text-xs font-semibold tracking-[0.12em] text-[var(--muted)] uppercase"
      >
        Matériel
      </h2>

      {offline ? (
        <p className="text-sm text-[var(--muted)]" role="status">
          Coordination indisponible hors connexion.
        </p>
      ) : null}

      {promotedNotice ? (
        <p className="text-sm text-[var(--foreground)]" role="status">
          L’équipement est maintenant disponible pour toi.
        </p>
      ) : null}

      {localError ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {localError}
        </p>
      ) : null}

      {my && my.state === 'USING' && my.equipment ? (
        <div className="flex flex-col gap-2 border-b border-[var(--border)] py-3">
          <p className="text-sm font-semibold uppercase tracking-wide">
            {my.equipment.name}
          </p>
          <p className="text-sm text-[var(--muted)]">
            Tu l’utilises actuellement
          </p>
          <Button
            type="button"
            className="w-fit"
            disabled={offline || busy}
            onClick={() => void onRelease()}
          >
            Libérer
          </Button>
        </div>
      ) : null}

      {my && my.state === 'WAITING' && my.equipment ? (
        <div className="flex flex-col gap-2 border-b border-[var(--border)] py-3">
          <p className="text-sm font-semibold uppercase tracking-wide">
            {my.equipment.name}
          </p>
          {my.occupiedBy ? (
            <p className="text-sm text-[var(--muted)]">
              Utilisée par {my.occupiedBy.displayName ?? 'un membre'}
            </p>
          ) : null}
          {my.queuePosition != null ? (
            <p className="text-sm text-[var(--foreground)]">
              Ta position : {my.queuePosition}
            </p>
          ) : (
            <p className="text-sm text-[var(--muted)]">En attente</p>
          )}
          <Button
            type="button"
            variant="secondary"
            className="w-fit"
            disabled={offline || busy}
            onClick={() => void onCancel()}
          >
            Quitter la file
          </Button>
        </div>
      ) : null}

      {my && my.state === 'AVAILABLE' && my.equipment ? (
        <div className="flex flex-col gap-2 border-b border-[var(--border)] py-3">
          <p className="text-sm font-semibold uppercase tracking-wide">
            {my.equipment.name}
          </p>
          {!my.occupiedBy ? (
            <>
              <p className="text-sm text-[var(--muted)]">Disponible</p>
              <Button
                type="button"
                className="w-fit"
                disabled={offline || busy}
                onClick={() => void onRequest()}
              >
                Utiliser
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-[var(--muted)]">
                Utilisée par {my.occupiedBy.displayName ?? 'un membre'}
              </p>
              <Button
                type="button"
                variant="secondary"
                className="w-fit"
                disabled={offline || busy}
                onClick={() => void onRequest()}
              >
                Rejoindre la file
              </Button>
            </>
          )}
        </div>
      ) : null}

      {(!my || my.state === 'NONE') && !coordinationQuery.isLoading ? (
        <p className="text-sm text-[var(--muted)]">
          Sélectionne un exercice avec équipement dans ta séance pour
          coordonner.
        </p>
      ) : null}

      {coordinationQuery.isLoading ? (
        <div className="h-16 animate-pulse rounded-[var(--radius-control)] bg-[var(--border)]/60" />
      ) : null}

      {equipmentList.length > 0 ? (
        <ul className="flex flex-col divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {equipmentList.map((item) => {
            const isMyEquipment =
              my?.equipment?.id === item.equipment.id &&
              (my.state === 'USING' || my.state === 'WAITING');
            if (isMyEquipment) return null;
            return (
              <li key={item.equipment.id} className="py-3 text-sm">
                <p className="font-semibold uppercase tracking-wide">
                  {item.equipment.name}
                </p>
                <p className="mt-1 text-[var(--muted)]">
                  {item.using
                    ? `Utilisée par ${item.using.displayName ?? 'un membre'}`
                    : 'Disponible'}
                </p>
                {item.waiting.length > 0 ? (
                  <div className="mt-2">
                    <p className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
                      File d’attente
                    </p>
                    <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-[var(--muted)]">
                      {item.waiting.map((waiter) => (
                        <li key={`${waiter.userId}-${waiter.position}`}>
                          {waiter.displayName ?? 'Participant'}
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
