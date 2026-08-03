import type { ExerciseDetail } from '@gym-companion/shared';
import { describe, expect, it } from 'vitest';

import {
  canArchiveExercise,
  canEditExercise,
  canRestoreExercise,
  detailToFormValues,
  EMPTY_EXERCISE_FORM_VALUES,
  ensureSinglePreferred,
  formValuesToCreatePayload,
  isExerciseFormDirty,
  normalizeSecondaryMuscleGroups,
  reconcileDefaultEquipment,
  removeCompatibleEquipment,
  type ExerciseFormValues,
} from '../lib/exercise-form';

const MUSCLE_CHEST = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const MUSCLE_BACK = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const MUSCLE_TRICEPS = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const EQ_BARBELL = '11111111-1111-1111-1111-111111111111';
const EQ_DUMBBELL = '22222222-2222-2222-2222-222222222222';

function createDetail(overrides: Partial<ExerciseDetail> = {}): ExerciseDetail {
  return {
    id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    source: 'USER',
    name: 'Curl personnalisé',
    measurementType: 'WEIGHT_REPS',
    primaryMuscleGroup: {
      id: MUSCLE_CHEST,
      code: 'chest',
      name: 'Pectoraux',
      parentId: null,
    },
    secondaryMuscleGroups: [
      {
        id: MUSCLE_TRICEPS,
        code: 'triceps',
        name: 'Triceps',
        parentId: null,
      },
    ],
    defaultEquipmentType: {
      id: EQ_BARBELL,
      code: 'barbell',
      name: 'Barre',
    },
    compatibleEquipmentTypes: [
      {
        equipmentType: {
          id: EQ_BARBELL,
          code: 'barbell',
          name: 'Barre',
        },
        isPreferred: true,
        notes: 'Prise large',
      },
      {
        equipmentType: {
          id: EQ_DUMBBELL,
          code: 'dumbbell',
          name: 'Haltères',
        },
        isPreferred: false,
        notes: null,
      },
    ],
    defaultRestSeconds: 90,
    instructions: 'Contrôler la descente.',
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    permissions: {
      canEdit: true,
      canArchive: true,
      canRestore: false,
    },
    userPreference: {
      isFavorite: true,
      isExcludedFromSuggestions: false,
      preferredEquipmentType: null,
      restSecondsOverride: 60,
    },
    ...overrides,
  };
}

describe('exercise-form helpers', () => {
  it('transforms detail to form values and preserves notes/preferred', () => {
    const values = detailToFormValues(createDetail());
    expect(values.name).toBe('Curl personnalisé');
    expect(values.primaryMuscleGroupId).toBe(MUSCLE_CHEST);
    expect(values.secondaryMuscleGroupIds).toEqual([MUSCLE_TRICEPS]);
    expect(values.defaultEquipmentTypeId).toBe(EQ_BARBELL);
    expect(values.compatibleEquipmentTypes).toEqual([
      {
        equipmentTypeId: EQ_BARBELL,
        isPreferred: true,
        notes: 'Prise large',
      },
      {
        equipmentTypeId: EQ_DUMBBELL,
        isPreferred: false,
        notes: '',
      },
    ]);
    expect(values.defaultRestSeconds).toBe('90');
    expect(values.instructions).toBe('Contrôler la descente.');
  });

  it('transforms form values to create payload with empty strings as null', () => {
    const values: ExerciseFormValues = {
      ...EMPTY_EXERCISE_FORM_VALUES,
      name: '  Squats libres  ',
      primaryMuscleGroupId: MUSCLE_BACK,
      secondaryMuscleGroupIds: [MUSCLE_CHEST],
      measurementType: 'BODYWEIGHT_REPS',
      compatibleEquipmentTypes: [
        {
          equipmentTypeId: EQ_DUMBBELL,
          isPreferred: true,
          notes: '  ',
        },
      ],
      defaultEquipmentTypeId: EQ_DUMBBELL,
      defaultRestSeconds: '',
      instructions: '',
    };

    const payload = formValuesToCreatePayload(values);
    expect(payload.name).toBe('Squats libres');
    expect(payload.defaultRestSeconds).toBeNull();
    expect(payload.instructions).toBeNull();
    expect(payload.compatibleEquipmentTypes[0]?.notes).toBeNull();
    expect(payload.defaultEquipmentTypeId).toBe(EQ_DUMBBELL);
  });

  it('removes primary from secondary muscle groups', () => {
    expect(
      normalizeSecondaryMuscleGroups(MUSCLE_CHEST, [
        MUSCLE_CHEST,
        MUSCLE_BACK,
        MUSCLE_BACK,
      ]),
    ).toEqual([MUSCLE_BACK]);
  });

  it('clears default equipment when it becomes incompatible', () => {
    const values: ExerciseFormValues = {
      ...EMPTY_EXERCISE_FORM_VALUES,
      compatibleEquipmentTypes: [
        {
          equipmentTypeId: EQ_BARBELL,
          isPreferred: false,
          notes: 'keep-me',
        },
        {
          equipmentTypeId: EQ_DUMBBELL,
          isPreferred: true,
          notes: 'also-keep',
        },
      ],
      defaultEquipmentTypeId: EQ_BARBELL,
    };

    const next = removeCompatibleEquipment(values, EQ_BARBELL);
    expect(next.defaultEquipmentTypeId).toBe('');
    expect(next.compatibleEquipmentTypes).toEqual([
      {
        equipmentTypeId: EQ_DUMBBELL,
        isPreferred: true,
        notes: 'also-keep',
      },
    ]);
  });

  it('keeps a single preferred equipment', () => {
    const result = ensureSinglePreferred(
      [
        { equipmentTypeId: EQ_BARBELL, isPreferred: true, notes: '' },
        { equipmentTypeId: EQ_DUMBBELL, isPreferred: true, notes: '' },
      ],
      EQ_DUMBBELL,
    );
    expect(result.filter((item) => item.isPreferred)).toHaveLength(1);
    expect(result.find((item) => item.isPreferred)?.equipmentTypeId).toBe(
      EQ_DUMBBELL,
    );
  });

  it('preserves equipment notes through payload transform', () => {
    const payload = formValuesToCreatePayload({
      ...EMPTY_EXERCISE_FORM_VALUES,
      name: 'Row',
      primaryMuscleGroupId: MUSCLE_BACK,
      compatibleEquipmentTypes: [
        {
          equipmentTypeId: EQ_BARBELL,
          isPreferred: false,
          notes: 'Note importante',
        },
      ],
    });
    expect(payload.compatibleEquipmentTypes[0]?.notes).toBe('Note importante');
  });

  it('detects form dirtiness', () => {
    const initial = detailToFormValues(createDetail());
    expect(isExerciseFormDirty(initial, initial)).toBe(false);
    expect(
      isExerciseFormDirty({ ...initial, name: 'Autre nom' }, initial),
    ).toBe(true);
  });

  it('reconciles incompatible default equipment to empty', () => {
    expect(reconcileDefaultEquipment(EQ_BARBELL, [EQ_DUMBBELL])).toBe('');
    expect(reconcileDefaultEquipment(EQ_BARBELL, [EQ_BARBELL])).toBe(EQ_BARBELL);
  });

  it('computes permissions for system, personal and archived exercises', () => {
    expect(
      canEditExercise({ canEdit: false, canArchive: false, canRestore: false }),
    ).toBe(false);
    expect(
      canArchiveExercise({ canEdit: true, canArchive: true, canRestore: false }),
    ).toBe(true);
    expect(
      canRestoreExercise({ canEdit: false, canArchive: false, canRestore: true }),
    ).toBe(true);
    expect(
      canEditExercise({ canEdit: false, canArchive: false, canRestore: true }),
    ).toBe(false);
  });
});
