export function ExerciseListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <ul className="flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <li
          key={index}
          className="animate-pulse rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4"
        >
          <div className="h-4 w-3/4 rounded bg-slate-200" />
          <div className="mt-3 h-3 w-1/2 rounded bg-slate-100" />
          <div className="mt-2 h-3 w-2/5 rounded bg-slate-100" />
          <div className="mt-4 h-5 w-20 rounded-full bg-slate-100" />
        </li>
      ))}
    </ul>
  );
}
