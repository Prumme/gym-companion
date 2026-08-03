export function canMoveUp(index: number): boolean {
  return index > 0;
}

export function canMoveDown(index: number, length: number): boolean {
  return index >= 0 && index < length - 1;
}

export function moveItemUp<T>(items: T[], index: number): T[] {
  if (!canMoveUp(index)) {
    return [...items];
  }
  const next = [...items];
  const current = next[index]!;
  next[index] = next[index - 1]!;
  next[index - 1] = current;
  return next;
}

export function moveItemDown<T>(items: T[], index: number): T[] {
  if (!canMoveDown(index, items.length)) {
    return [...items];
  }
  const next = [...items];
  const current = next[index]!;
  next[index] = next[index + 1]!;
  next[index + 1] = current;
  return next;
}

export function orderedIdsFromItems<T extends { id: string }>(items: T[]): string[] {
  return items.map((item) => item.id);
}
