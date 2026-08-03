export function LoadingState({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center text-[var(--muted)]" role="status">
      {label}
    </div>
  );
}
