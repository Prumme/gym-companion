import type { MuscleGroupReference, TrainingGoal } from '@gym-companion/shared';
import type { SystemExerciseCatalogItem } from '@gym-companion/shared';
import type { ProgramImportError } from '@gym-companion/shared';
import {
  formatSystemExerciseCatalogLine,
  PROGRAM_IMPORT_V1_CONTRACT_TEXT,
} from '@gym-companion/validation';

export const EXPERIENCE_LEVELS = [
  'BEGINNER',
  'INTERMEDIATE',
  'ADVANCED',
] as const;

export type ProgramImportExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const EQUIPMENT_PREFERENCES = [
  'machines',
  'free-weights',
  'mixed',
] as const;

export type ProgramImportEquipmentPreference =
  (typeof EQUIPMENT_PREFERENCES)[number];

export const DURATION_OPTIONS = [30, 45, 60, 75, 90] as const;

export type ProgramImportBrief = {
  goal: TrainingGoal;
  workoutCount: number;
  durationMinutes: (typeof DURATION_OPTIONS)[number];
  experienceLevel: ProgramImportExperienceLevel;
  musclePriorities: string[];
  equipmentPreference: ProgramImportEquipmentPreference;
  freeText: string;
};

export const EMPTY_PROGRAM_IMPORT_BRIEF: ProgramImportBrief = {
  goal: 'HYPERTROPHY',
  workoutCount: 3,
  durationMinutes: 60,
  experienceLevel: 'BEGINNER',
  musclePriorities: [],
  equipmentPreference: 'mixed',
  freeText: '',
};

const GOAL_PROMPT_LABELS: Record<TrainingGoal, string> = {
  ENDURANCE: 'muscular endurance (ENDURANCE)',
  HYPERTROPHY: 'hypertrophy / volume (HYPERTROPHY)',
  STRENGTH: 'strength (STRENGTH)',
  GENERAL_FITNESS: 'mixed / general fitness (GENERAL_FITNESS)',
};

const LEVEL_PROMPT_LABELS: Record<ProgramImportExperienceLevel, string> = {
  BEGINNER: 'beginner (BEGINNER)',
  INTERMEDIATE: 'intermediate (INTERMEDIATE)',
  ADVANCED: 'advanced (ADVANCED)',
};

const EQUIPMENT_PROMPT_LABELS: Record<
  ProgramImportEquipmentPreference,
  string
> = {
  machines: 'prefer machines when a comparable option exists',
  'free-weights': 'prefer free weights (barbell / dumbbell)',
  mixed: 'mixed equipment is fine',
};

function formatCatalog(catalog: SystemExerciseCatalogItem[]): string {
  return catalog.map((item) => formatSystemExerciseCatalogLine(item)).join('\n');
}

export function buildProgramImportPrompt(
  brief: ProgramImportBrief,
  catalog: SystemExerciseCatalogItem[],
  muscles: MuscleGroupReference[],
): string {
  const muscleNames = brief.musclePriorities
    .map((code) => muscles.find((item) => item.code === code)?.name ?? code)
    .join(', ');

  const freeText =
    brief.freeText.trim().length > 0
      ? brief.freeText.trim()
      : '(no additional details)';

  return [
    'You are generating a gym strength-training program for import into Gym Companion.',
    '',
    'USER REQUEST',
    `- Goal: ${GOAL_PROMPT_LABELS[brief.goal]}`,
    `- Number of workouts: ${brief.workoutCount}`,
    `- Approximate duration per workout: ${brief.durationMinutes} minutes`,
    `- Experience level: ${LEVEL_PROMPT_LABELS[brief.experienceLevel]}`,
    `- Muscle priorities: ${muscleNames.length > 0 ? muscleNames : '(none specified)'}`,
    `- Equipment preference: ${EQUIPMENT_PROMPT_LABELS[brief.equipmentPreference]}`,
    `- Additional details: ${freeText}`,
    '',
    'This is a training-log import request, not a medical or sports prescription.',
    '',
    'STRICT RULES',
    '- Only use exercises listed in AVAILABLE EXERCISES.',
    '- Use exerciseSlug exactly as listed. Never invent a slug.',
    '- Never invent internal IDs or UUIDs.',
    '- Return ONLY JSON.',
    '- Do not use Markdown.',
    '- Do not wrap the JSON in ```json fences.',
    '- Do not include comments.',
    '- Do not include any text before or after the JSON.',
    '- Respect schemaVersion 1 exactly.',
    '- Respect the schema below.',
    `- program.goal must be exactly ${brief.goal}.`,
    `- program.workouts length must be ${brief.workoutCount}.`,
    `- Each workout.estimatedDurationMinutes should be close to ${brief.durationMinutes}.`,
    '',
    'JSON CONTRACT (schemaVersion 1)',
    PROGRAM_IMPORT_V1_CONTRACT_TEXT,
    '',
    'ALLOWED ENUMS',
    'goal: ENDURANCE | HYPERTROPHY | STRENGTH | GENERAL_FITNESS',
    '',
    'AVAILABLE EXERCISES',
    'Format: slug | name | primaryMuscle | equipment | measurementType',
    formatCatalog(catalog),
  ].join('\n');
}

export function buildProgramImportCorrectionPrompt(input: {
  jsonText: string;
  errors: ProgramImportError[];
  catalog: SystemExerciseCatalogItem[];
}): string {
  const includeCatalog = input.errors.some(
    (error) => error.code === 'UNKNOWN_EXERCISE',
  );
  const errorLines = input.errors.map((error) => {
    const suggestions =
      error.suggestions && error.suggestions.length > 0
        ? ` suggestions=[${error.suggestions.join(', ')}]`
        : '';
    return `- ${error.path} [${error.code}] ${error.message}${suggestions}`;
  });

  return [
    'Correct ONLY the reported validation errors.',
    'Preserve the rest of the program whenever possible.',
    'Return ONLY valid JSON.',
    'Do not use Markdown or code fences.',
    '',
    'schemaVersion must remain 1.',
    '',
    'CURRENT JSON',
    input.jsonText.trim(),
    '',
    'VALIDATION ERRORS',
    ...errorLines,
    '',
    'JSON CONTRACT (schemaVersion 1)',
    PROGRAM_IMPORT_V1_CONTRACT_TEXT,
    ...(includeCatalog
      ? [
          '',
          'AVAILABLE EXERCISES',
          'Format: slug | name | primaryMuscle | equipment | measurementType',
          formatCatalog(input.catalog),
        ]
      : []),
  ].join('\n');
}
