/** Formate une date locale YYYY-MM-DD pour l’affichage. */
export function formatStartedOn(localDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!match) {
    return localDate;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  try {
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(
      new Date(year, month - 1, day),
    );
  } catch {
    return localDate;
  }
}

export function formatProgramUpdatedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatShortDescription(
  description: string | null,
  max = 120,
): string | null {
  if (!description) {
    return null;
  }
  const trimmed = description.trim();
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max - 1)}…`;
}
