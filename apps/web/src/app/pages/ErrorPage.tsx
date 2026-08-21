import { isRouteErrorResponse, useRouteError } from 'react-router-dom';

export function ErrorPage() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? error.statusText
    : error instanceof Error
      ? error.message
      : 'Une erreur inattendue est survenue!';

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-bold">Erreur</h1>
      <p className="text-[var(--muted)]">{message}</p>
    </main>
  );
}
