import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { PageHeader } from '@/components/layout/PageHeader';
import { Button, ButtonLink } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api/client';

import { useCreateSharedWorkoutRoomMutation } from '../hooks/use-shared-workout-mutations';

export function CreateSharedWorkoutRoomPage() {
  const navigate = useNavigate();
  const createMutation = useCreateSharedWorkoutRoomMutation();
  const [name, setName] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (offline) {
      setSubmitError(
        'Une connexion est nécessaire pour gérer une séance partagée.',
      );
      return;
    }
    setSubmitError(null);
    try {
      const room = await createMutation.mutateAsync({
        name: name.trim() || undefined,
      });
      void navigate(`/shared-workouts/${room.id}`, { replace: true });
    } catch (error) {
      setSubmitError(
        getApiErrorMessage(error, 'Impossible de créer la salle.'),
      );
    }
  }

  return (
    <main className="flex w-full flex-1 flex-col gap-6">
      <PageHeader
        title="Créer une salle"
        description="Tu seras le propriétaire de la salle."
        backTo="/shared-workouts"
        backLabel="Partagées"
        className="mb-0"
      />

      <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Nom</span>
          <input
            id="shared-workout-room-name"
            aria-label="Nom de la salle"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            placeholder="Séance partagée"
            className="min-h-11 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] px-3 outline-none focus:border-[var(--foreground)]"
          />
        </label>

        {submitError ? (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {submitError}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={createMutation.isPending || offline}>
            Créer la salle
          </Button>
          <ButtonLink to="/shared-workouts" variant="secondary">
            Annuler
          </ButtonLink>
        </div>
      </form>
    </main>
  );
}
