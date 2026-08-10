import { describe, expect, it } from 'vitest';

import {
  comparePersonalRecordPrimary,
  decodePersonalRecordsCursor,
  encodePersonalRecordsCursor,
  getPersonalRecordPrincipalValue,
  isBetterPersonalRecordCandidate,
  isSetEligibleForPersonalRecord,
  parsePersonalRecordsQuery,
  resolveRecordTypesForMeasurement,
  selectCurrentPersonalRecordsWithType,
  type PersonalRecordCandidate,
} from './personal-records';

function candidate(
  overrides: Partial<PersonalRecordCandidate> &
    Pick<PersonalRecordCandidate, 'workoutSetId' | 'sourceExerciseId'>,
): PersonalRecordCandidate {
  return {
    workoutSessionExerciseId: 'wse-1',
    workoutSessionId: 'ws-1',
    exerciseNameSnapshot: 'Développé couché',
    measurementTypeSnapshot: 'WEIGHT_REPS',
    equipmentTypeId: 'eq-bar',
    equipmentNameSnapshot: 'Barre',
    setType: 'WORKING',
    actualWeightKg: 100,
    actualReps: 8,
    actualDurationSeconds: null,
    actualDistanceMeters: null,
    actualRir: 2,
    actualRpe: null,
    reachedFailure: false,
    achievedOn: '2026-08-10',
    achievedAt: '2026-08-10T10:00:00.000Z',
    ...overrides,
  };
}

describe('personal records eligibility', () => {
  it('accepte séance COMPLETED + série COMPLETED hors WARMUP', () => {
    expect(
      isSetEligibleForPersonalRecord({
        sessionStatus: 'COMPLETED',
        setStatus: 'COMPLETED',
        setType: 'WORKING',
        sourceExerciseId: 'ex-1',
      }),
    ).toBe(true);
  });

  it('exclut séance CANCELLED / ACTIVE / PAUSED / PLANNED', () => {
    for (const sessionStatus of ['CANCELLED', 'ACTIVE', 'PAUSED', 'PLANNED']) {
      expect(
        isSetEligibleForPersonalRecord({
          sessionStatus,
          setStatus: 'COMPLETED',
          setType: 'WORKING',
          sourceExerciseId: 'ex-1',
        }),
      ).toBe(false);
    }
  });

  it('exclut PARTIAL / FAILED / SKIPPED / PENDING', () => {
    for (const setStatus of ['PARTIAL', 'FAILED', 'SKIPPED', 'PENDING']) {
      expect(
        isSetEligibleForPersonalRecord({
          sessionStatus: 'COMPLETED',
          setStatus,
          setType: 'WORKING',
          sourceExerciseId: 'ex-1',
        }),
      ).toBe(false);
    }
  });

  it('exclut WARMUP', () => {
    expect(
      isSetEligibleForPersonalRecord({
        sessionStatus: 'COMPLETED',
        setStatus: 'COMPLETED',
        setType: 'WARMUP',
        sourceExerciseId: 'ex-1',
      }),
    ).toBe(false);
  });

  it('exclut sourceExerciseId null', () => {
    expect(
      isSetEligibleForPersonalRecord({
        sessionStatus: 'COMPLETED',
        setStatus: 'COMPLETED',
        setType: 'WORKING',
        sourceExerciseId: null,
      }),
    ).toBe(false);
  });
});

describe('resolveRecordTypesForMeasurement', () => {
  it('WEIGHT_REPS → MAX_WEIGHT + MAX_REPS', () => {
    expect(resolveRecordTypesForMeasurement('WEIGHT_REPS')).toEqual([
      'MAX_WEIGHT',
      'MAX_REPS',
    ]);
  });

  it('BODYWEIGHT / ASSISTED / REPS_ONLY → MAX_REPS seulement', () => {
    expect(resolveRecordTypesForMeasurement('BODYWEIGHT_REPS')).toEqual([
      'MAX_REPS',
    ]);
    expect(
      resolveRecordTypesForMeasurement('ASSISTED_BODYWEIGHT_REPS'),
    ).toEqual(['MAX_REPS']);
    expect(resolveRecordTypesForMeasurement('REPS_ONLY')).toEqual(['MAX_REPS']);
  });

  it('DURATION → MAX_DURATION', () => {
    expect(resolveRecordTypesForMeasurement('DURATION')).toEqual([
      'MAX_DURATION',
    ]);
  });

  it('DISTANCE_DURATION → MAX_DISTANCE', () => {
    expect(resolveRecordTypesForMeasurement('DISTANCE_DURATION')).toEqual([
      'MAX_DISTANCE',
    ]);
  });

  it('WEIGHT_DURATION → MAX_WEIGHT + MAX_DURATION', () => {
    expect(resolveRecordTypesForMeasurement('WEIGHT_DURATION')).toEqual([
      'MAX_WEIGHT',
      'MAX_DURATION',
    ]);
  });
});

describe('compare / select records', () => {
  it('MAX_WEIGHT tie-break reps', () => {
    expect(
      comparePersonalRecordPrimary(
        'MAX_WEIGHT',
        { actualWeightKg: 100, actualReps: 8, actualDurationSeconds: null, actualDistanceMeters: null },
        { actualWeightKg: 100, actualReps: 5, actualDurationSeconds: null, actualDistanceMeters: null },
      ),
    ).toBe(1);
  });

  it('MAX_REPS tie-break poids', () => {
    expect(
      comparePersonalRecordPrimary(
        'MAX_REPS',
        {
          actualWeightKg: 80,
          actualReps: 12,
          actualDurationSeconds: null,
          actualDistanceMeters: null,
        },
        {
          actualWeightKg: 70,
          actualReps: 12,
          actualDurationSeconds: null,
          actualDistanceMeters: null,
        },
      ),
    ).toBe(1);
  });

  it('MAX_DISTANCE tie-break durée ASC', () => {
    expect(
      comparePersonalRecordPrimary(
        'MAX_DISTANCE',
        {
          actualWeightKg: null,
          actualReps: null,
          actualDurationSeconds: 300,
          actualDistanceMeters: 1000,
        },
        {
          actualWeightKg: null,
          actualReps: null,
          actualDurationSeconds: 320,
          actualDistanceMeters: 1000,
        },
      ),
    ).toBe(1);
  });

  it('égalité → première occurrence (date plus ancienne)', () => {
    const earlier = candidate({
      workoutSetId: 'set-a',
      sourceExerciseId: 'ex-1',
      actualWeightKg: 100,
      actualReps: 8,
      achievedOn: '2026-08-01',
    });
    const later = candidate({
      workoutSetId: 'set-b',
      sourceExerciseId: 'ex-1',
      actualWeightKg: 100,
      actualReps: 8,
      achievedOn: '2026-08-10',
    });
    expect(isBetterPersonalRecordCandidate('MAX_WEIGHT', earlier, later)).toBe(
      true,
    );
  });

  it('ignore valeur principale null', () => {
    expect(
      getPersonalRecordPrincipalValue('MAX_WEIGHT', {
        actualWeightKg: null,
        actualReps: 10,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
      }),
    ).toBeNull();
  });

  it('sélectionne MAX_WEIGHT et MAX_REPS distincts', () => {
    const heavy = candidate({
      workoutSetId: 'set-heavy',
      sourceExerciseId: 'ex-1',
      actualWeightKg: 120,
      actualReps: 3,
      achievedOn: '2026-08-02',
    });
    const highReps = candidate({
      workoutSetId: 'set-reps',
      sourceExerciseId: 'ex-1',
      actualWeightKg: 60,
      actualReps: 15,
      achievedOn: '2026-08-03',
    });
    const selected = selectCurrentPersonalRecordsWithType([heavy, highReps]);
    const byType = Object.fromEntries(
      selected.map((entry) => [entry.recordType, entry.candidate.workoutSetId]),
    );
    expect(byType.MAX_WEIGHT).toBe('set-heavy');
    expect(byType.MAX_REPS).toBe('set-reps');
  });

  it('distingue les équipements', () => {
    const bar = candidate({
      workoutSetId: 'set-bar',
      sourceExerciseId: 'ex-1',
      equipmentTypeId: 'eq-bar',
      actualWeightKg: 100,
    });
    const dumbbell = candidate({
      workoutSetId: 'set-db',
      sourceExerciseId: 'ex-1',
      equipmentTypeId: 'eq-db',
      equipmentNameSnapshot: 'Haltères',
      actualWeightKg: 36,
    });
    const selected = selectCurrentPersonalRecordsWithType([bar, dumbbell]);
    const weights = selected.filter((e) => e.recordType === 'MAX_WEIGHT');
    expect(weights).toHaveLength(2);
  });

  it('DURATION / DISTANCE / WEIGHT_DURATION / BODYWEIGHT', () => {
    const duration = candidate({
      workoutSetId: 'set-dur',
      sourceExerciseId: 'ex-plank',
      measurementTypeSnapshot: 'DURATION',
      actualWeightKg: null,
      actualReps: null,
      actualDurationSeconds: 120,
    });
    const distance = candidate({
      workoutSetId: 'set-dist',
      sourceExerciseId: 'ex-run',
      measurementTypeSnapshot: 'DISTANCE_DURATION',
      actualWeightKg: null,
      actualReps: null,
      actualDurationSeconds: 400,
      actualDistanceMeters: 1500,
    });
    const bodyweight = candidate({
      workoutSetId: 'set-bw',
      sourceExerciseId: 'ex-pull',
      measurementTypeSnapshot: 'BODYWEIGHT_REPS',
      actualWeightKg: null,
      actualReps: 20,
    });
    const assisted = candidate({
      workoutSetId: 'set-as',
      sourceExerciseId: 'ex-as',
      measurementTypeSnapshot: 'ASSISTED_BODYWEIGHT_REPS',
      actualWeightKg: 20,
      actualReps: 12,
    });
    const weightDur = candidate({
      workoutSetId: 'set-wd',
      sourceExerciseId: 'ex-farm',
      measurementTypeSnapshot: 'WEIGHT_DURATION',
      actualWeightKg: 40,
      actualReps: null,
      actualDurationSeconds: 90,
    });

    const selected = selectCurrentPersonalRecordsWithType([
      duration,
      distance,
      bodyweight,
      assisted,
      weightDur,
    ]);
    expect(
      selected.find((e) => e.candidate.workoutSetId === 'set-dur')?.recordType,
    ).toBe('MAX_DURATION');
    expect(
      selected.find((e) => e.candidate.workoutSetId === 'set-dist')?.recordType,
    ).toBe('MAX_DISTANCE');
    expect(
      selected.find((e) => e.candidate.workoutSetId === 'set-bw')?.recordType,
    ).toBe('MAX_REPS');
    expect(
      selected.find((e) => e.candidate.workoutSetId === 'set-as')?.recordType,
    ).toBe('MAX_REPS');
    const farm = selected.filter((e) => e.candidate.workoutSetId === 'set-wd');
    expect(farm.map((e) => e.recordType).sort()).toEqual([
      'MAX_DURATION',
      'MAX_WEIGHT',
    ]);
  });

  it('n’invente pas de règle d’assistance (ASSISTED : reps seulement)', () => {
    const moreAssist = candidate({
      workoutSetId: 'set-more',
      sourceExerciseId: 'ex-as',
      measurementTypeSnapshot: 'ASSISTED_BODYWEIGHT_REPS',
      actualWeightKg: 30,
      actualReps: 10,
      achievedOn: '2026-08-01',
    });
    const lessAssist = candidate({
      workoutSetId: 'set-less',
      sourceExerciseId: 'ex-as',
      measurementTypeSnapshot: 'ASSISTED_BODYWEIGHT_REPS',
      actualWeightKg: 10,
      actualReps: 8,
      achievedOn: '2026-08-02',
    });
    const selected = selectCurrentPersonalRecordsWithType([
      moreAssist,
      lessAssist,
    ]);
    expect(selected).toHaveLength(1);
    expect(selected[0]?.candidate.workoutSetId).toBe('set-more');
  });
});

describe('personalRecordsQuerySchema / cursor', () => {
  it('parse une query valide', () => {
    const parsed = parsePersonalRecordsQuery({
      recordType: 'MAX_WEIGHT',
      limit: '10',
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.recordType).toBe('MAX_WEIGHT');
      expect(parsed.data.limit).toBe(10);
    }
  });

  it('rejette un recordType inconnu', () => {
    const parsed = parsePersonalRecordsQuery({ recordType: 'MAX_VOLUME' });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.code).toBe('PERSONAL_RECORD_INVALID_TYPE');
    }
  });

  it('encode / decode cursor opaque', () => {
    const encoded = encodePersonalRecordsCursor({
      version: 1,
      achievedOn: '2026-08-10',
      exerciseId: 'ex-1',
      equipmentTypeId: null,
      recordType: 'MAX_REPS',
    });
    expect(decodePersonalRecordsCursor(encoded)).toEqual({
      version: 1,
      achievedOn: '2026-08-10',
      exerciseId: 'ex-1',
      equipmentTypeId: null,
      recordType: 'MAX_REPS',
    });
  });
});
