import { describe, expect, it } from 'vitest';

import {
  locationFromJsonSyntaxError,
  parseImportedJsonText,
} from '../lib/parse-imported-json';
import {
  buildProgramImportCorrectionPrompt,
  buildProgramImportPrompt,
  EMPTY_PROGRAM_IMPORT_BRIEF,
} from '../lib/program-import-prompt';
import { describeProgramImportError } from '../lib/program-import-errors';

const catalog = [
  {
    slug: 'developpe-couche-barre',
    name: 'Développé couché à la barre',
    primaryMuscleCode: 'chest',
    defaultEquipmentCode: 'barbell',
    measurementType: 'WEIGHT_REPS' as const,
  },
  {
    slug: 'chest-press-machine',
    name: 'Chest Press machine',
    primaryMuscleCode: 'chest',
    defaultEquipmentCode: 'machine',
    measurementType: 'WEIGHT_REPS' as const,
  },
  {
    slug: 'planche',
    name: 'Planche',
    primaryMuscleCode: 'core',
    defaultEquipmentCode: 'bodyweight',
    measurementType: 'DURATION' as const,
  },
];

const muscles = [
  { id: 'm1', code: 'chest', name: 'Pectoraux', parentId: null },
  { id: 'm2', code: 'back', name: 'Dos', parentId: null },
];

describe('parseImportedJsonText', () => {
  it('signale une erreur de syntaxe avec ligne et colonne', () => {
    const result = parseImportedJsonText('{\n  "foo": \n}');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/JSON invalide/);
      expect(result.message).toMatch(/Ligne \d+/);
    }
  });

  it('parse un objet valide', () => {
    const result = parseImportedJsonText('{"schemaVersion":1}');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ schemaVersion: 1 });
    }
  });
});

describe('buildProgramImportPrompt', () => {
  it('intègre le brief, le catalogue et les règles JSON only', () => {
    const prompt = buildProgramImportPrompt(
      {
        ...EMPTY_PROGRAM_IMPORT_BRIEF,
        goal: 'HYPERTROPHY',
        workoutCount: 3,
        durationMinutes: 60,
        experienceLevel: 'BEGINNER',
        musclePriorities: ['chest', 'back'],
        equipmentPreference: 'mixed',
        freeText:
          'Je vais généralement à la salle trois fois par semaine, parfois quatre.',
      },
      catalog,
      muscles,
    );

    expect(prompt).toContain(
      'You are generating a gym strength-training program for import into Gym Companion.',
    );
    expect(prompt).toContain('Return ONLY JSON.');
    expect(prompt).toContain('Do not wrap the JSON in ```json fences.');
    expect(prompt).toContain('HYPERTROPHY');
    expect(prompt).toContain('Number of workouts: 3');
    expect(prompt).toContain('60 minutes');
    expect(prompt).toContain('beginner');
    expect(prompt).toContain('Pectoraux');
    expect(prompt).toContain('mixed equipment');
    expect(prompt).toContain(
      'Je vais généralement à la salle trois fois par semaine',
    );
    expect(prompt).toContain(
      'developpe-couche-barre | Développé couché à la barre | chest | barbell | WEIGHT_REPS',
    );
    expect(prompt).toContain('planche | Planche | core | bodyweight | DURATION');
    expect(prompt).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
  });

  it('produit un prompt de correction déterministe', () => {
    const prompt = buildProgramImportCorrectionPrompt({
      jsonText: '{"schemaVersion":1}',
      errors: [
        {
          path: 'program.workouts[0].exercises[0].exerciseSlug',
          code: 'UNKNOWN_EXERCISE',
          message: 'Exercice inconnu : fake-chest-machine.',
          suggestions: ['chest-press-machine'],
        },
      ],
      catalog,
    });
    expect(prompt).toContain('Correct ONLY the reported validation errors.');
    expect(prompt).toContain('Return ONLY valid JSON.');
    expect(prompt).toContain('Do not use Markdown or code fences.');
    expect(prompt).toContain('fake-chest-machine');
    expect(prompt).toContain('chest-press-machine');
    expect(prompt).toContain('developpe-couche-barre');
  });
});

describe('describeProgramImportError', () => {
  it('conserve le path technique et nomme la séance', () => {
    const described = describeProgramImportError(
      {
        path: 'program.workouts[1].exercises[0].sets[1].repsMin',
        code: 'INVALID_TARGETS',
        message: '12 ne peut pas être supérieur à repsMax 8.',
      },
      {
        program: {
          workouts: [{ name: 'Push' }, { name: 'Legs' }],
        },
      },
    );
    expect(described.title).toContain('Legs');
    expect(described.title).toContain('Série 2');
    expect(described.path).toBe(
      'program.workouts[1].exercises[0].sets[1].repsMin',
    );
  });
});

describe('locationFromJsonSyntaxError', () => {
  it('extrait une position V8', () => {
    const error = new SyntaxError('Unexpected token } in JSON at position 12');
    expect(locationFromJsonSyntaxError('{\n  "a": }\n', error)).toEqual({
      line: expect.any(Number),
      column: expect.any(Number),
    });
  });
});
