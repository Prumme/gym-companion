import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { useJoinSharedWorkoutMutation } from '../hooks/use-shared-workout-mutations';
import { getJoinSharedWorkoutErrorMessage } from '../lib/shared-workout-join-errors';
import { isCompleteSharedWorkoutJoinCode } from '../lib/shared-workout-join-code-input';
import { SharedWorkoutJoinCodeInput } from './SharedWorkoutJoinCodeInput';

type SharedWorkoutJoinSheetProps = {
  open: boolean;
  onClose: () => void;
};

export function SharedWorkoutJoinSheet({
  open,
  onClose,
}: SharedWorkoutJoinSheetProps) {
  const titleId = useId();
  const helperId = useId();
  const errorId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const joinMutation = useJoinSharedWorkoutMutation();

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCode('');
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !joinMutation.isPending) onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose, joinMutation.isPending]);

  if (!open) {
    return null;
  }

  const canSubmit = isCompleteSharedWorkoutJoinCode(code) && !joinMutation.isPending;

  async function handleSubmit() {
    if (!canSubmit) return;
    setError(null);
    try {
      const room = await joinMutation.mutateAsync({ code });
      onClose();
      void navigate(`/shared-workouts/${room.id}`);
    } catch (err) {
      setError(getJoinSharedWorkoutErrorMessage(err));
    }
  }

  return (
    <div className="fixed inset-0 z-50" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-[var(--foreground)]/40"
        aria-label="Fermer"
        disabled={joinMutation.isPending}
        onClick={() => {
          if (!joinMutation.isPending) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-[var(--radius-surface)] border border-[var(--border)] bg-[var(--surface)] px-[var(--space-4)] pt-[var(--space-4)] shadow-lg md:inset-x-auto md:right-4 md:bottom-4 md:left-auto md:w-full md:max-w-md md:rounded-[var(--radius-surface)]"
        style={{
          paddingBottom:
            'calc(var(--space-6) + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="mb-[var(--space-4)] flex items-center justify-between gap-3">
          <h2 id={titleId} className="section-title">
            Rejoindre une salle
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            disabled={joinMutation.isPending}
            className="inline-flex size-11 items-center justify-center rounded-[var(--radius-control)] text-[var(--muted-foreground)] hover:bg-[var(--background)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] disabled:opacity-60"
            aria-label="Fermer"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <p id={helperId} className="text-sm text-[var(--muted)]">
            Entre le code partagé par l’hôte.
          </p>

          <SharedWorkoutJoinCodeInput
            value={code}
            onChange={setCode}
            disabled={joinMutation.isPending}
            invalid={Boolean(error)}
            describedBy={`${helperId}${error ? ` ${errorId}` : ''}`}
          />

          {error ? (
            <p id={errorId} className="text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={!canSubmit}>
            {joinMutation.isPending ? 'Connexion…' : 'Rejoindre'}
          </Button>
        </form>
      </div>
    </div>
  );
}
