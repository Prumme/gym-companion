import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main className="flex flex-1 flex-col gap-4">
      <h1 className="text-2xl font-bold">Page introuvable</h1>
      <p className="text-[var(--muted)]">Cette page n&apos;existe pas.</p>
      <Link className="font-semibold text-[var(--primary)]" to="/">
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}
