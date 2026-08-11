import { NavLink } from 'react-router-dom';

import {
  isNavItemActive,
  moreNavGroups,
  primaryNavItems,
} from '@/app/navigation/nav-config';
import { cn } from '@/lib/utils';

type AppSidebarProps = {
  pathname: string;
};

export function AppSidebar({ pathname }: AppSidebarProps) {
  return (
    <aside
      aria-label="Navigation latérale"
      className="sticky top-0 hidden h-dvh w-[var(--sidebar-width)] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] px-[var(--space-3)] py-[var(--space-6)] md:flex"
    >
      <p className="mb-[var(--space-6)] px-2 text-xs font-semibold tracking-[0.14em] text-[var(--muted-foreground)] uppercase">
        Gym Companion
      </p>

      <nav className="flex flex-1 flex-col gap-[var(--space-6)]">
        <ul className="flex flex-col gap-1">
          {primaryNavItems.map((item) => {
            const Icon = item.icon;
            const active = isNavItemActive(item, pathname);
            return (
              <li key={item.id}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-11 items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm font-medium',
                    active
                      ? 'bg-[var(--background)] text-[var(--foreground)]'
                      : 'text-[var(--muted-foreground)] hover:bg-[var(--background)] hover:text-[var(--foreground)]',
                  )}
                >
                  <Icon
                    className={cn('size-5 shrink-0', active && 'stroke-[2.5px]')}
                    aria-hidden="true"
                  />
                  {item.label}
                  {active ? (
                    <span
                      className="ml-auto size-2 rounded-full bg-[var(--primary)]"
                      aria-hidden="true"
                    />
                  ) : null}
                </NavLink>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-col gap-[var(--space-4)]">
          <p className="px-3 text-[0.6875rem] font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
            Plus
          </p>
          {moreNavGroups.map((group) => (
            <div key={group.id}>
              <p className="mb-1 px-3 text-[0.625rem] font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
                {group.label}
              </p>
              <ul className="flex flex-col gap-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isNavItemActive(item, pathname);
                  return (
                    <li key={item.id}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex min-h-11 items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm font-medium',
                          active
                            ? 'bg-[var(--background)] text-[var(--foreground)]'
                            : 'text-[var(--muted-foreground)] hover:bg-[var(--background)] hover:text-[var(--foreground)]',
                        )}
                      >
                        <Icon className="size-5 shrink-0" aria-hidden="true" />
                        {item.label}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>
    </aside>
  );
}
