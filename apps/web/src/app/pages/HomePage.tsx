import { ButtonLink } from '@/components/ui/button';

export function HomePage() {
  return (
    <main className="flex flex-1 flex-col gap-6">
      <section className="rounded-[1rem] border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h1 className="mb-2 text-3xl font-bold tracking-tight">Gym Companion</h1>
        <p className="mb-6 text-[var(--muted)]">
          Suivi d&apos;entraînement mobile-first. Les fondations Phase 0 sont en place.
        </p>
        <div className="flex flex-col gap-3">
          <ButtonLink to="/login">Se connecter</ButtonLink>
          <ButtonLink to="/register" variant="secondary">
            Créer un compte
          </ButtonLink>
        </div>
      </section>
    </main>
  );
}
