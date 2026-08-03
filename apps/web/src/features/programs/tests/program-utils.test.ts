import { describe, expect, it } from 'vitest';

import {
  detailToProgramFormValues,
  parseIncludeArchivedParam,
  programFormToCreatePayload,
} from '../lib/program-form';
import {
  canMoveDown,
  canMoveUp,
  moveItemDown,
  moveItemUp,
  orderedIdsFromItems,
} from '../lib/reorder';
import {
  buildAddExerciseDefaults,
  durationPartsToSeconds,
  formatSetSummary,
  getInitialEquipmentTypeId,
  getInitialRestSeconds,
  setFormToPayload,
} from '../lib/template-forms';
import { getWorkoutSetTypeLabel } from '../lib/program-labels';
import {
  reorderExercisesInDetail,
  reorderSetsInDetail,
  reorderTemplatesInDetail,
} from '../lib/program-cache';
import { createProgramDetail, createSet, createTemplate } from './fixtures';

describe('program form transforms', () => {
  it('maps detail to form and payload with optional normalization', () => {
    const values = detailToProgramFormValues({
      name: 'Force',
      description: null,
      goal: 'STRENGTH',
    });
    expect(values).toEqual({
      name: 'Force',
      description: '',
      goal: 'STRENGTH',
    });
    expect(
      programFormToCreatePayload({
        name: ' Force ',
        description: '  ',
        goal: 'STRENGTH',
      }),
    ).toEqual({
      name: 'Force',
      description: null,
      goal: 'STRENGTH',
    });
  });

  it('parses includeArchived strictly', () => {
    expect(parseIncludeArchivedParam('true')).toBe(true);
    expect(parseIncludeArchivedParam('1')).toBe(true);
    expect(parseIncludeArchivedParam('false')).toBe(false);
    expect(parseIncludeArchivedParam('maybe')).toBe(false);
    expect(parseIncludeArchivedParam(null)).toBe(false);
  });
});

describe('reorder helpers', () => {
  it('moves within bounds and builds ordered ids', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(canMoveUp(0)).toBe(false);
    expect(canMoveDown(2, 3)).toBe(false);
    expect(moveItemUp(items, 0)).toEqual(items);
    expect(moveItemDown(items, 2)).toEqual(items);
    expect(orderedIdsFromItems(moveItemUp(items, 1))).toEqual(['b', 'a', 'c']);
    expect(orderedIdsFromItems(moveItemDown(items, 0))).toEqual(['b', 'a', 'c']);
  });

  it('applies template reorder and supports rollback snapshot', () => {
    const detail = createProgramDetail({
      workoutTemplates: [
        createTemplate({ id: 't1', name: 'A', position: 0, exercises: [] }),
        createTemplate({ id: 't2', name: 'B', position: 1, exercises: [] }),
      ],
    });
    const snapshot = structuredClone(detail);
    const result = reorderTemplatesInDetail(detail, 1, 'up');
    expect(result.orderedIds).toEqual(['t2', 't1']);
    expect(result.next.workoutTemplates.map((t) => t.id)).toEqual(['t2', 't1']);
    expect(snapshot.workoutTemplates.map((t) => t.id)).toEqual(['t1', 't2']);
  });

  it('reorders exercises and sets', () => {
    const detail = createProgramDetail();
    const template = detail.workoutTemplates[0]!;
    template.exercises = [
      { ...template.exercises[0]!, id: 'e1', position: 0 },
      {
        ...template.exercises[0]!,
        id: 'e2',
        position: 1,
        sets: [createSet({ id: 's1' }), createSet({ id: 's2', position: 1 })],
      },
    ];
    const exerciseResult = reorderExercisesInDetail(detail, template.id, 1, 'up');
    expect(exerciseResult?.orderedIds).toEqual(['e2', 'e1']);

    const setResult = reorderSetsInDetail(
      detail,
      template.id,
      'e2',
      1,
      'up',
    );
    expect(setResult?.orderedIds).toEqual(['s2', 's1']);
  });
});

describe('template exercise defaults', () => {
  it('prefers user equipment then default', () => {
    expect(
      getInitialEquipmentTypeId({
        defaultEquipmentType: { id: 'eq-default', code: 'db', name: 'Haltères' },
        userPreference: {
          isFavorite: false,
          isExcludedFromSuggestions: false,
          preferredEquipmentType: {
            id: 'eq-pref',
            code: 'bb',
            name: 'Barre',
          },
          restSecondsOverride: null,
        },
        compatibleEquipmentTypes: [
          { equipmentType: { id: 'eq-pref' }, isPreferred: false },
          { equipmentType: { id: 'eq-default' }, isPreferred: true },
        ],
      }),
    ).toBe('eq-pref');

    expect(
      getInitialEquipmentTypeId({
        defaultEquipmentType: { id: 'eq-default', code: 'db', name: 'Haltères' },
        userPreference: {
          isFavorite: false,
          isExcludedFromSuggestions: false,
          preferredEquipmentType: null,
          restSecondsOverride: null,
        },
        compatibleEquipmentTypes: [],
      }),
    ).toBe('eq-default');
  });

  it('prefers user rest then exercise default', () => {
    expect(
      getInitialRestSeconds({
        defaultRestSeconds: 90,
        userPreference: {
          isFavorite: false,
          isExcludedFromSuggestions: false,
          preferredEquipmentType: null,
          restSecondsOverride: 45,
        },
      }),
    ).toBe('45');
    expect(
      getInitialRestSeconds({
        defaultRestSeconds: 90,
        userPreference: {
          isFavorite: false,
          isExcludedFromSuggestions: false,
          preferredEquipmentType: null,
          restSecondsOverride: null,
        },
      }),
    ).toBe('90');
  });

  it('builds add defaults', () => {
    const defaults = buildAddExerciseDefaults({
      id: 'ex',
      source: 'SYSTEM',
      name: 'Squat',
      measurementType: 'WEIGHT_REPS',
      primaryMuscleGroup: {
        id: 'm',
        code: 'quads',
        name: 'Quadriceps',
        parentId: null,
      },
      defaultEquipmentType: { id: 'eq', code: 'bb', name: 'Barre' },
      defaultRestSeconds: 120,
      archivedAt: null,
      permissions: { canEdit: false, canArchive: false, canRestore: false },
      userPreference: {
        isFavorite: false,
        isExcludedFromSuggestions: false,
        preferredEquipmentType: null,
        restSecondsOverride: null,
      },
      compatibleEquipmentTypes: [
        {
          equipmentType: { id: 'eq', code: 'bb', name: 'Barre' },
          isPreferred: true,
          notes: null,
        },
      ],
    });
    expect(defaults.equipmentTypeId).toBe('eq');
    expect(defaults.restSecondsOverride).toBe('120');
  });
});

describe('set labels and payloads', () => {
  it('maps set types and formats relevant targets', () => {
    expect(getWorkoutSetTypeLabel('WARMUP')).toBe('Échauffement');
    expect(getWorkoutSetTypeLabel('AMRAP')).toBe('Maximum de répétitions');
    expect(
      formatSetSummary(
        createSet({
          targetRepMin: 8,
          targetRepMax: 8,
          targetRir: 2,
          restSeconds: 90,
          targetWeightKg: null,
        }),
      ),
    ).toContain('8 répétitions');
  });

  it('converts duration parts and builds payload', () => {
    expect(durationPartsToSeconds('1', '30')).toBe(90);
    expect(durationPartsToSeconds('', '')).toBeNull();
    expect(
      setFormToPayload({
        setType: 'WORKING',
        targetRepMin: '8',
        targetRepMax: '10',
        targetDurationMinutes: '',
        targetDurationSeconds: '',
        targetDistanceMeters: '',
        targetWeightKg: '60',
        targetIntensityPercent: '',
        targetRir: '2',
        targetRpe: '',
        restSeconds: '90',
      }),
    ).toMatchObject({
      setType: 'WORKING',
      targetRepMin: 8,
      targetRepMax: 10,
      targetWeightKg: 60,
      targetRir: 2,
      targetRpe: null,
      restSeconds: 90,
    });
  });
});
