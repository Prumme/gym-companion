import type { ProgramImportError } from '@gym-companion/shared';

function getAtPath(value: unknown, path: string): unknown {
  if (!path) {
    return value;
  }
  const tokens = path.match(/[^.[\]]+/g) ?? [];
  let current: unknown = value;
  for (const token of tokens) {
    if (current == null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[token];
  }
  return current;
}

function workoutName(payload: unknown, workoutIndex: number): string | null {
  const name = getAtPath(payload, `program.workouts.${workoutIndex}.name`);
  return typeof name === 'string' && name.trim().length > 0 ? name : null;
}

function parseIndexedPath(path: string): {
  workoutIndex: number | null;
  exerciseIndex: number | null;
  setIndex: number | null;
  field: string;
} {
  const workout = /workouts\[(\d+)\]/.exec(path);
  const exercise = /exercises\[(\d+)\]/.exec(path);
  const set = /sets\[(\d+)\]/.exec(path);
  const field = path.split('.').pop() ?? path;
  return {
    workoutIndex: workout ? Number(workout[1]) : null,
    exerciseIndex: exercise ? Number(exercise[1]) : null,
    setIndex: set ? Number(set[1]) : null,
    field,
  };
}

export function describeProgramImportError(
  error: ProgramImportError,
  payload: unknown,
): { title: string; message: string; path: string } {
  const parsed = parseIndexedPath(error.path);
  const parts: string[] = [];
  if (parsed.workoutIndex != null) {
    const name = workoutName(payload, parsed.workoutIndex);
    parts.push(
      name
        ? `Séance « ${name} »`
        : `Séance ${parsed.workoutIndex + 1}`,
    );
  }
  if (parsed.exerciseIndex != null) {
    parts.push(`Exercice ${parsed.exerciseIndex + 1}`);
  }
  if (parsed.setIndex != null) {
    parts.push(`Série ${parsed.setIndex + 1}`);
  }

  const title = parts.length > 0 ? parts.join(' → ') : error.path || 'JSON';
  const field = parsed.field && parsed.field !== error.path ? parsed.field : null;
  const message = field ? `${field}\n${error.message}` : error.message;

  return {
    title,
    message,
    path: error.path,
  };
}
