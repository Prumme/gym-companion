import { PageHeader } from '@/components/layout/PageHeader';
import { CardLink } from '@/components/ui/card';
import { trainingHubLinks } from '@/app/navigation/nav-config';

export function TrainingHubPage() {
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        title="Entraînement"
        description="Planning, programmes et historique de tes séances."
      />
      <ul className="flex flex-col gap-[var(--space-3)]">
        {trainingHubLinks.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.id}>
              <CardLink to={item.to} aria-label={item.label}>
                <div className="flex items-center gap-3">
                  <span className="inline-flex size-10 items-center justify-center rounded-[var(--radius-control)] bg-[var(--background)]">
                    <Icon
                      className="size-5 text-[var(--muted-foreground)]"
                      aria-hidden="true"
                    />
                  </span>
                  <span className="text-base font-semibold">{item.label}</span>
                </div>
              </CardLink>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
