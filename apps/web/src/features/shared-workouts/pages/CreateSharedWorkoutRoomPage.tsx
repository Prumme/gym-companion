import { ArrowLeft } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6">
      <div>
        <ButtonLink
          to="/shared-workouts"
          variant="ghost"
          className="mb-3 w-fit gap-2 px-0"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Retour
        </ButtonLink>
        <h1 className="text-2xl font-bold tracking-tight">Créer une salle</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Tu seras le propriétaire. Les invitations arriveront dans un prochain
          jalon.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Nom de la salle</span>
          <input
            id="shared-workout-room-name"
            aria-label="Nom de la salle"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            placeholder="Séance partagée"
            className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-transparent px-3"
          />
        </label>

        {submitError ? (
          <p role="alert" className="text-sm text-[var(--destructive)]">
            {submitError}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={createMutation.isPending || offline}>
            Créer la salle
          </Button>
          <ButtonLink to="/shared-workouts" variant="ghost">
            Annuler
          </ButtonLink>
        </div>
      </form>
    </main>
  );
}
