export function ExerciseListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul className="flex flex-col" aria-busy="true" aria-label="Chargement">
      {Array.from({ length: count }, (_, index) => (
        <li
          key={index}
          className="flex min-h-11 animate-pulse flex-col gap-1.5 border-b border-[var(--border)] py-3"
        >
          <div className="h-3.5 w-2/3 rounded bg-[var(--border)]/60" />
          <div className="h-3 w-1/2 rounded bg-[var(--border)]/40" />
          <div className="h-3 w-2/5 rounded bg-[var(--border)]/40" />
        </li>
      ))}
    </ul>
  );
}
