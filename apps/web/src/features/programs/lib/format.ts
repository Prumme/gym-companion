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
