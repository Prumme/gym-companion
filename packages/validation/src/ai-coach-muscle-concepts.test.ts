import { describe, expect, it } from 'vitest';
import {
  AI_COACH_MUSCLE_CONCEPT_ALIASES,
  aiCoachMuscleConceptKey,
  resolveAiCoachMuscleConcept,
} from './ai-coach-muscle-concepts';

describe('ai-coach-muscle-concepts', () => {
  it('résout bras → biceps + triceps', () => {
    expect(resolveAiCoachMuscleConcept('Bras')).toEqual(['biceps', 'triceps']);
    expect(resolveAiCoachMuscleConcept('arms')).toEqual(['biceps', 'triceps']);
    expect(aiCoachMuscleConceptKey('bras')).toBe('bras');
  });

  it('résout jambes → familles référentielles', () => {
    expect(resolveAiCoachMuscleConcept('jambes')).toEqual([
      'quadriceps',
      'hamstrings',
      'glutes',
      'calves',
    ]);
  });

  it('résout pecs / full body / haut du corps', () => {
    expect(resolveAiCoachMuscleConcept('pecs')).toEqual(['chest']);
    expect(resolveAiCoachMuscleConcept('full body')?.length).toBeGreaterThan(4);
    expect(resolveAiCoachMuscleConcept('haut du corps')).toContain('chest');
    expect(resolveAiCoachMuscleConcept('haut du corps')).toContain('back');
  });

  it('retourne null pour un MuscleGroup exact (pas un concept)', () => {
    expect(resolveAiCoachMuscleConcept('Biceps')).toBeNull();
    expect(resolveAiCoachMuscleConcept('Dos')).toBeNull();
    expect(aiCoachMuscleConceptKey('Dos')).toBeNull();
  });

  it('aliases sans UUID hardcodés', () => {
    for (const codes of Object.values(AI_COACH_MUSCLE_CONCEPT_ALIASES)) {
      expect(codes.every((code) => !code.includes('-') || code.length < 40)).toBe(
        true,
      );
      expect(codes.every((code) => !/^[0-9a-f-]{36}$/i.test(code))).toBe(true);
    }
  });
});
