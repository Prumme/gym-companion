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
 * Shared 5.6 — section Équipements + actions sur mon équipement courant.
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
    <section
      aria-labelledby="equipment-heading"
      className="rounded-[var(--radius)] border border-[var(--border)] p-4"
    >
      <h2 id="equipment-heading" className="text-lg font-semibold">
        Équipements
      </h2>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Coordination logique (type d’équipement), pas un inventaire physique de
        la salle.
      </p>

      {offline ? (
        <p className="mt-3 text-sm text-[var(--muted)]" role="status">
          Coordination indisponible hors connexion.
        </p>
      ) : null}

      {promotedNotice ? (
        <p className="mt-3 text-sm text-[var(--foreground)]" role="status">
          L’équipement est maintenant disponible pour toi.
        </p>
      ) : null}

      {localError ? (
        <p className="mt-2 text-sm text-[var(--danger)]" role="alert">
          {localError}
        </p>
      ) : null}

      {my && my.state !== 'NONE' && my.equipment ? (
        <div className="mt-3 rounded-[var(--radius)] border border-[var(--border)]/70 p-3 text-sm">
          <p>
            Équipement :{' '}
            <span className="font-medium text-[var(--foreground)]">
              {my.equipment.name}
            </span>
          </p>
          {my.state === 'USING' ? (
            <>
              <p className="mt-1 text-[var(--muted)]">
                Tu utilises cet équipement
              </p>
              <Button
                type="button"
                className="mt-2"
                disabled={offline || busy}
                onClick={() => void onRelease()}
              >
                Libérer l’équipement
              </Button>
            </>
          ) : null}
          {my.state === 'WAITING' ? (
            <>
              <p className="mt-1 text-[var(--muted)]">
                En attente
                {my.queuePosition != null
                  ? ` · position ${my.queuePosition}`
                  : ''}
                {my.occupiedBy
                  ? ` · utilisé par ${my.occupiedBy.displayName ?? 'un membre'}`
                  : ''}
              </p>
              <Button
                type="button"
                variant="secondary"
                className="mt-2"
                disabled={offline || busy}
                onClick={() => void onCancel()}
              >
                Quitter la file
              </Button>
            </>
          ) : null}
          {my.state === 'AVAILABLE' && !my.occupiedBy ? (
            <Button
              type="button"
              className="mt-2"
              disabled={offline || busy}
              onClick={() => void onRequest()}
            >
              Utiliser cet équipement
            </Button>
          ) : null}
          {my.state === 'AVAILABLE' && my.occupiedBy ? (
            <>
              <p className="mt-1 text-[var(--muted)]">
                Utilisé par {my.occupiedBy.displayName ?? 'un membre'}
              </p>
              <Button
                type="button"
                variant="secondary"
                className="mt-2"
                disabled={offline || busy}
                onClick={() => void onRequest()}
              >
                Rejoindre la file
              </Button>
            </>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-sm text-[var(--muted)]">
          Sélectionne un exercice avec équipement dans ta séance pour
          coordonner.
        </p>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {equipmentList.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            Aucun équipement partagé utilisé pour le moment.
          </p>
        ) : (
          equipmentList.map((item) => (
            <article
              key={item.equipment.id}
              className="rounded-[var(--radius)] border border-[var(--border)]/60 p-3 text-sm"
            >
              <h3 className="font-medium">{item.equipment.name}</h3>
              <p className="mt-1 text-[var(--muted)]">
                {item.using
                  ? `Utilisée par ${item.using.displayName ?? 'un membre'}`
                  : 'Libre'}
              </p>
              {item.waiting.length > 0 ? (
                <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-[var(--muted)]">
                  {item.waiting.map((waiter) => (
                    <li key={`${waiter.userId}-${waiter.position}`}>
                      {waiter.displayName ?? 'Participant'}
                    </li>
                  ))}
                </ol>
              ) : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
