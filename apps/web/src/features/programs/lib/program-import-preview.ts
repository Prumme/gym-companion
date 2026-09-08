import type { ProgramImportSetPreview } from '@gym-companion/shared';

function formatRest(seconds: number): string {
  if (seconds % 60 === 0) {
    const minutes = seconds / 60;
    return minutes === 1 ? 'repos 1 min' : `repos ${minutes} min`;
  }
  if (seconds > 60) {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return `repos ${minutes} min ${rest} s`;
  }
  return `repos ${seconds} s`;
}

function setKey(set: ProgramImportSetPreview): string {
  return [
    set.repsMin,
    set.repsMax,
    set.durationSeconds,
    set.distanceMeters,
    set.weightKg,
    set.rir,
    set.rpe,
    set.restSeconds,
  ].join('|');
}

function formatOneSet(set: ProgramImportSetPreview): string {
  const parts: string[] = [];
  if (set.repsMin != null && set.repsMax != null) {
    parts.push(
      set.repsMin === set.repsMax
        ? `${set.repsMin}`
        : `${set.repsMin}–${set.repsMax}`,
    );
  }
  if (set.durationSeconds != null) {
    parts.push(`${set.durationSeconds} s`);
  }
  if (set.distanceMeters != null) {
    parts.push(`${set.distanceMeters} m`);
  }
  if (set.weightKg != null) {
    parts.push(`${set.weightKg} kg`);
  }
  if (set.rir != null) {
    parts.push(`RIR ${set.rir}`);
  }
  if (set.rpe != null) {
    parts.push(`RPE ${set.rpe}`);
  }
  if (set.restSeconds != null) {
    parts.push(formatRest(set.restSeconds));
  }
  return parts.join(' · ');
}

export function formatGroupedSetSummaries(
  sets: ProgramImportSetPreview[],
): string[] {
  if (sets.length === 0) {
    return [];
  }
  const groups: Array<{ count: number; set: ProgramImportSetPreview }> = [];
  for (const set of sets) {
    const last = groups[groups.length - 1];
    if (last && setKey(last.set) === setKey(set)) {
      last.count += 1;
    } else {
      groups.push({ count: 1, set });
    }
  }
  return groups.map((group) => {
    const detail = formatOneSet(group.set);
    const hasReps = group.set.repsMin != null && group.set.repsMax != null;
    if (hasReps) {
      const range =
        group.set.repsMin === group.set.repsMax
          ? String(group.set.repsMin)
          : `${group.set.repsMin}–${group.set.repsMax}`;
      const rest: string[] = [];
      if (group.set.weightKg != null) rest.push(`${group.set.weightKg} kg`);
      if (group.set.rir != null) rest.push(`RIR ${group.set.rir}`);
      if (group.set.rpe != null) rest.push(`RPE ${group.set.rpe}`);
      if (group.set.restSeconds != null) rest.push(formatRest(group.set.restSeconds));
      const suffix = rest.length > 0 ? ` · ${rest.join(' · ')}` : '';
      return `${group.count} × ${range}${suffix}`;
    }
    return group.count > 1 ? `${group.count} × ${detail}` : detail;
  });
}
