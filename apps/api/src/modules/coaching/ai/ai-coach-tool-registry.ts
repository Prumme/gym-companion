import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { AiCoachChatReference } from '@gym-companion/shared';
import {
  AI_COACH_READ_ONLY_TOOL_NAMES,
  AI_COACH_RECENT_WORKOUTS_MAX,
  AI_COACH_SEARCH_EXERCISES_DEFAULT_LIMIT,
  AI_COACH_SEARCH_EXERCISES_MAX_RESULTS,
  aiCoachMuscleConceptKey,
  assertReadOnlyToolRegistry,
  getActiveProgramToolArgsSchema,
  getExerciseCoachSummaryToolArgsSchema,
  getExerciseProgressToolArgsSchema,
  getExerciseStrengthToolArgsSchema,
  getPersonalRecordsToolArgsSchema,
  getProgramDetailToolArgsSchema,
  getRecentWorkoutsToolArgsSchema,
  getWorkoutDetailToolArgsSchema,
  normalizeExerciseName,
  resolveAiCoachMuscleConcept,
  searchExercisesToolArgsSchema,
  type AiCoachReadOnlyToolName,
} from '@gym-companion/validation';

import { PrismaService } from '../../../database/prisma/prisma.service';
import { ExercisesService } from '../../exercises/exercises.service';
import { PersonalRecordsService } from '../../personal-records/personal-records.service';
import { ProgramsService } from '../../programs/programs.service';
import { ProgressService } from '../../progress/progress.service';
import { WorkoutsService } from '../../workouts/workouts.service';
import { CoachSummaryService } from '../coach-summary.service';

export type AiCoachToolExecutionContext = {
  ownerUserId: string;
};

export type AiCoachToolExecutionResult = {
  toolName: AiCoachReadOnlyToolName;
  /** Payload minimal envoyé au LLM. */
  llmPayload: unknown;
  /** Résumé audit (pas le payload complet). */
  outputSummary: Record<string, unknown>;
  /** Références dérivées de cet outil. */
  references: AiCoachChatReference[];
};

assertReadOnlyToolRegistry(AI_COACH_READ_ONLY_TOOL_NAMES);

@Injectable()
export class AiCoachToolRegistry {
  private readonly logger = new Logger(AiCoachToolRegistry.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly coachSummaryService: CoachSummaryService,
    private readonly progressService: ProgressService,
    private readonly personalRecordsService: PersonalRecordsService,
    private readonly workoutsService: WorkoutsService,
    private readonly exercisesService: ExercisesService,
    private readonly programsService: ProgramsService,
  ) {}

  listToolNames(): readonly string[] {
    return AI_COACH_READ_ONLY_TOOL_NAMES;
  }

  async execute(
    toolName: string,
    rawArgs: unknown,
    context: AiCoachToolExecutionContext,
  ): Promise<AiCoachToolExecutionResult> {
    if (
      !(AI_COACH_READ_ONLY_TOOL_NAMES as readonly string[]).includes(toolName)
    ) {
      return {
        toolName: 'get_exercise_coach_summary',
        llmPayload: {
          error: 'UNKNOWN_TOOL',
          message: 'Outil non disponible.',
        },
        outputSummary: { error: 'UNKNOWN_TOOL', toolName },
        references: [],
      };
    }

    const name = toolName as AiCoachReadOnlyToolName;
    // Ignorer toute tentative d’injection ownerUserId / userId dans les args.
    const sanitized =
      rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs)
        ? Object.fromEntries(
            Object.entries(rawArgs as Record<string, unknown>).filter(
              ([key]) =>
                key !== 'ownerUserId' &&
                key !== 'userId' &&
                key !== 'sql' &&
                !key.toLowerCase().includes('password'),
            ),
          )
        : {};

    try {
      switch (name) {
        case 'get_exercise_coach_summary':
          return await this.getExerciseCoachSummary(sanitized, context);
        case 'get_exercise_progress':
          return await this.getExerciseProgress(sanitized, context);
        case 'get_exercise_strength':
          return await this.getExerciseStrength(sanitized, context);
        case 'get_personal_records':
          return await this.getPersonalRecords(sanitized, context);
        case 'get_recent_workouts':
          return await this.getRecentWorkouts(sanitized, context);
        case 'get_workout_detail':
          return await this.getWorkoutDetail(sanitized, context);
        case 'search_exercises':
          return await this.searchExercises(sanitized, context);
        case 'get_active_program':
          return await this.getActiveProgram(sanitized, context);
        case 'get_program_detail':
          return await this.getProgramDetail(sanitized, context);
        default: {
          const _exhaustive: never = name;
          return {
            toolName: 'get_exercise_coach_summary',
            llmPayload: { error: 'UNKNOWN_TOOL', tool: _exhaustive },
            outputSummary: { error: 'UNKNOWN_TOOL' },
            references: [],
          };
        }
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        return {
          toolName: name,
          llmPayload: {
            error: 'NOT_FOUND',
            message: 'Ressource introuvable ou inaccessible.',
          },
          outputSummary: { error: 'NOT_FOUND', toolName: name },
          references: [],
        };
      }
      return {
        toolName: name,
        llmPayload: {
          error: 'TOOL_FAILED',
          message: 'Impossible d’exécuter l’outil.',
        },
        outputSummary: { error: 'TOOL_FAILED', toolName: name },
        references: [],
      };
    }
  }

  private async getExerciseCoachSummary(
    args: Record<string, unknown>,
    context: AiCoachToolExecutionContext,
  ): Promise<AiCoachToolExecutionResult> {
    const parsed = getExerciseCoachSummaryToolArgsSchema.parse(args);
    const summary = await this.coachSummaryService.getExerciseCoachSummary(
      context.ownerUserId,
      parsed.exerciseId,
      {},
    );
    return {
      toolName: 'get_exercise_coach_summary',
      llmPayload: {
        exercise: summary.exercise,
        status: summary.status,
        headline: summary.headline,
        loadRecommendation: summary.loadRecommendation
          ? {
              action: summary.loadRecommendation.action,
              currentWeightKg: summary.loadRecommendation.currentWeightKg,
              suggestedWeightKg: summary.loadRecommendation.suggestedWeightKg,
              reasons: summary.loadRecommendation.reasons,
            }
          : null,
        plateau: summary.plateau
          ? {
              status: summary.plateau.status,
              reasons: summary.plateau.reasons,
              analyzedWorkoutCount: summary.plateau.analyzedWorkoutCount,
            }
          : null,
        progress: summary.progress,
        strength: summary.strength,
        notices: summary.notices.map((notice) => ({
          code: notice.code,
          severity: notice.severity,
        })),
      },
      outputSummary: {
        exerciseId: summary.exercise.id,
        status: summary.status,
        loadAction: summary.loadRecommendation?.action ?? null,
        plateauStatus: summary.plateau?.status ?? null,
      },
      references: [
        {
          type: 'EXERCISE',
          exerciseId: summary.exercise.id,
          label: summary.exercise.name,
        },
        {
          type: 'PROGRESS',
          exerciseId: summary.exercise.id,
          label: `Progression — ${summary.exercise.name}`,
        },
      ],
    };
  }

  private async getExerciseProgress(
    args: Record<string, unknown>,
    context: AiCoachToolExecutionContext,
  ): Promise<AiCoachToolExecutionResult> {
    const parsed = getExerciseProgressToolArgsSchema.parse(args);
    const query: Record<string, string | undefined> = {
      from: parsed.from,
      to: parsed.to,
      metric: parsed.metric,
    };
    const progress = await this.progressService.getExerciseProgress(
      context.ownerUserId,
      parsed.exerciseId,
      query,
    );
    const points = progress.points.slice(-8).map((point) => ({
      localDate: point.localDate,
      value: point.value,
      maxWeightKg: point.context.maxWeightKg,
      maxReps: point.context.maxReps,
    }));
    return {
      toolName: 'get_exercise_progress',
      llmPayload: {
        exerciseId: progress.exercise.id,
        exerciseName: progress.exercise.name,
        selectedMetric: progress.selectedMetric,
        availableMetrics: progress.availableMetrics,
        summary: progress.summary,
        recentPoints: points,
      },
      outputSummary: {
        exerciseId: progress.exercise.id,
        selectedMetric: progress.selectedMetric,
        pointCount: progress.points.length,
      },
      references: [
        {
          type: 'PROGRESS',
          exerciseId: progress.exercise.id,
          label: `Progression — ${progress.exercise.name}`,
        },
      ],
    };
  }

  private async getExerciseStrength(
    args: Record<string, unknown>,
    context: AiCoachToolExecutionContext,
  ): Promise<AiCoachToolExecutionResult> {
    const parsed = getExerciseStrengthToolArgsSchema.parse(args);
    const strength = await this.progressService.getExerciseStrengthProgress(
      context.ownerUserId,
      parsed.exerciseId,
      { from: parsed.from, to: parsed.to },
    );
    return {
      toolName: 'get_exercise_strength',
      llmPayload: {
        exerciseId: strength.exercise.id,
        exerciseName: strength.exercise.name,
        supported: strength.supported,
        formula: strength.formula,
        summary: strength.summary
          ? {
              latestEstimatedOneRepMaxKg:
                strength.summary.latestEstimatedOneRepMaxKg,
              bestEstimatedOneRepMaxKg:
                strength.summary.bestEstimatedOneRepMaxKg,
              absoluteChangeKg: strength.summary.absoluteChangeKg,
              percentageChange: strength.summary.percentageChange,
            }
          : null,
        note: 'Valeurs = 1RM estimé, pas une charge réellement soulevée.',
      },
      outputSummary: {
        exerciseId: strength.exercise.id,
        supported: strength.supported,
        latestEstimatedOneRepMaxKg:
          strength.summary?.latestEstimatedOneRepMaxKg ?? null,
      },
      references: [
        {
          type: 'PROGRESS',
          exerciseId: strength.exercise.id,
          label: `Force estimée — ${strength.exercise.name}`,
        },
      ],
    };
  }

  private async getPersonalRecords(
    args: Record<string, unknown>,
    context: AiCoachToolExecutionContext,
  ): Promise<AiCoachToolExecutionResult> {
    const parsed = getPersonalRecordsToolArgsSchema.parse(args);
    const records = parsed.exerciseId
      ? await this.personalRecordsService.listForExercise(
          context.ownerUserId,
          parsed.exerciseId,
        )
      : (
          await this.personalRecordsService.list(context.ownerUserId, {
            limit: '10',
          })
        ).data;

    const compact = records.slice(0, 10).map((record) => ({
      exerciseId: record.exerciseId,
      exerciseName: record.exercise.name,
      recordType: record.recordType,
      value: record.value,
      achievedOn: record.achievedOn,
      context: {
        weightKg: record.context.weightKg,
        reps: record.context.reps,
      },
    }));

    const references: AiCoachChatReference[] = [];
    for (const record of compact) {
      if (
        !references.some(
          (ref) =>
            ref.type === 'EXERCISE' && ref.exerciseId === record.exerciseId,
        )
      ) {
        references.push({
          type: 'EXERCISE',
          exerciseId: record.exerciseId,
          label: record.exerciseName,
        });
      }
    }

    return {
      toolName: 'get_personal_records',
      llmPayload: {
        count: compact.length,
        records: compact,
      },
      outputSummary: {
        count: compact.length,
        exerciseId: parsed.exerciseId ?? null,
      },
      references,
    };
  }

  private async getRecentWorkouts(
    args: Record<string, unknown>,
    context: AiCoachToolExecutionContext,
  ): Promise<AiCoachToolExecutionResult> {
    const parsed = getRecentWorkoutsToolArgsSchema.parse(args);
    const limit = Math.min(
      parsed.limit ?? AI_COACH_RECENT_WORKOUTS_MAX,
      AI_COACH_RECENT_WORKOUTS_MAX,
    );
    const history = await this.workoutsService.listHistory(context.ownerUserId, {
      limit: String(Math.max(limit, AI_COACH_RECENT_WORKOUTS_MAX)),
      status: 'COMPLETED',
    });

    let items = history.data.slice(0, limit);
    if (parsed.exerciseId) {
      const filtered = [];
      for (const item of history.data) {
        try {
          const detail = await this.workoutsService.getById(
            context.ownerUserId,
            item.id,
          );
          const match = detail.exercises.some(
            (occurrence) => occurrence.sourceExerciseId === parsed.exerciseId,
          );
          if (match) filtered.push(item);
        } catch {
          // ignore
        }
        if (filtered.length >= limit) break;
      }
      items = filtered;
    }

    return {
      toolName: 'get_recent_workouts',
      llmPayload: {
        count: items.length,
        workouts: items.map((item) => ({
          workoutSessionId: item.id,
          localDate: item.localDate,
          status: item.status,
          name: item.name,
        })),
      },
      outputSummary: {
        count: items.length,
        exerciseId: parsed.exerciseId ?? null,
      },
      references: items.map((item) => ({
        type: 'WORKOUT' as const,
        workoutSessionId: item.id,
        label: item.name
          ? `Séance — ${item.name}`
          : `Séance du ${item.localDate}`,
      })),
    };
  }

  private async getWorkoutDetail(
    args: Record<string, unknown>,
    context: AiCoachToolExecutionContext,
  ): Promise<AiCoachToolExecutionResult> {
    const parsed = getWorkoutDetailToolArgsSchema.parse(args);
    const detail = await this.workoutsService.getById(
      context.ownerUserId,
      parsed.workoutSessionId,
    );
    return {
      toolName: 'get_workout_detail',
      llmPayload: {
        workoutSessionId: detail.id,
        localDate: detail.localDate,
        status: detail.status,
        name: detail.name,
        exercises: detail.exercises.slice(0, 12).map((occurrence) => ({
          sourceExerciseId: occurrence.sourceExerciseId,
          name: occurrence.exerciseName,
          measurementType: occurrence.measurementType,
          workingSets: occurrence.sets
            .filter((set) => set.setType === 'WORKING')
            .slice(0, 8)
            .map((set) => ({
              status: set.status,
              actualWeightKg: set.actualWeightKg,
              actualReps: set.actualReps,
            })),
        })),
      },
      outputSummary: {
        workoutSessionId: detail.id,
        localDate: detail.localDate,
        exerciseCount: detail.exercises.length,
      },
      references: [
        {
          type: 'WORKOUT',
          workoutSessionId: detail.id,
          label: detail.name
            ? `Séance — ${detail.name}`
            : `Séance du ${detail.localDate}`,
        },
      ],
    };
  }

  /** Jalon 8 — seule source de vrais exerciseId pour construire une proposal. */
  private async searchExercises(
    args: Record<string, unknown>,
    context: AiCoachToolExecutionContext,
  ): Promise<AiCoachToolExecutionResult> {
    const parsed = searchExercisesToolArgsSchema.parse(args);
    const queryText = parsed.query ?? parsed.search;
    const limit = Math.min(
      parsed.limit ?? AI_COACH_SEARCH_EXERCISES_DEFAULT_LIMIT,
      AI_COACH_SEARCH_EXERCISES_MAX_RESULTS,
    );

    const conceptKey = parsed.muscleGroup
      ? aiCoachMuscleConceptKey(parsed.muscleGroup)
      : null;

    const unresolved: Record<string, string> = {};
    let muscleGroupIds: string[] = [];
    if (parsed.muscleGroupId) {
      muscleGroupIds = [parsed.muscleGroupId];
    } else if (parsed.muscleGroup) {
      muscleGroupIds = await this.resolveMuscleGroupIds(parsed.muscleGroup);
      if (muscleGroupIds.length === 0) {
        unresolved.muscleGroup = parsed.muscleGroup;
      }
    }

    let equipmentTypeId = parsed.equipmentTypeId;
    if (!equipmentTypeId && parsed.equipmentType) {
      equipmentTypeId =
        (await this.resolveEquipmentTypeId(parsed.equipmentType)) ?? undefined;
      if (!equipmentTypeId) unresolved.equipmentType = parsed.equipmentType;
    }

    let excludeEquipmentTypeId = parsed.excludeEquipmentTypeId;
    if (!excludeEquipmentTypeId && parsed.excludeEquipmentType) {
      excludeEquipmentTypeId =
        (await this.resolveEquipmentTypeId(parsed.excludeEquipmentType)) ??
        undefined;
      if (!excludeEquipmentTypeId) {
        unresolved.excludeEquipmentType = parsed.excludeEquipmentType;
      }
    }

    // Label non résolu → résultats vides + hint (évite une recherche name="Dos").
    if (Object.keys(unresolved).length > 0) {
      this.logger.log({
        event: 'ai_coach.search',
        concept: conceptKey,
        resolvedGroupsCount: 0,
        strictEquipment: Boolean(equipmentTypeId),
        query: queryText ?? null,
        muscleGroup: parsed.muscleGroup ?? null,
        equipmentType: parsed.equipmentType ?? null,
        resultCount: 0,
        unresolved,
      });
      return {
        toolName: 'search_exercises',
        llmPayload: {
          count: 0,
          exercises: [],
          unresolved,
          hint: 'Utilise un label/concept connu (ex. muscleGroup:"bras"|"Biceps"|"Dos", pecs, jambes). « en salle » ≠ filtre Machine.',
        },
        outputSummary: {
          count: 0,
          idsPresent: 0,
          unresolved,
          query: queryText ?? null,
        },
        references: [],
      };
    }

    const runSearch = async (equipmentFilter: string | undefined) =>
      this.collectSearchExercises({
        ownerUserId: context.ownerUserId,
        queryText,
        muscleGroupIds,
        equipmentTypeId: equipmentFilter,
        excludeEquipmentTypeId,
        measurementType: parsed.measurementType,
        limit,
      });

    // NIVEAU 1 — critères demandés (muscle ± équipement strict).
    let exercises = await runSearch(equipmentTypeId);
    let fallback: 'none' | 'dropped_equipment' | 'neighbor_query' = 'none';

    // NIVEAU 2 — si équipement strict → 0, élargir sans équipement (contexte salle).
    if (exercises.length === 0 && equipmentTypeId) {
      exercises = await runSearch(undefined);
      if (exercises.length > 0) {
        fallback = 'dropped_equipment';
      }
    }

    // NIVEAU 3 — query voisine minimale si toujours vide et concept connu.
    if (exercises.length === 0 && conceptKey && !queryText) {
      const neighborQuery =
        conceptKey === 'bras' || conceptKey === 'arms' || conceptKey === 'arm'
          ? 'curl'
          : conceptKey === 'jambes' ||
              conceptKey === 'jambe' ||
              conceptKey === 'legs' ||
              conceptKey === 'leg'
            ? 'squat'
            : conceptKey === 'pecs' ||
                conceptKey === 'pec' ||
                conceptKey === 'poitrine'
              ? 'developpe'
              : null;
      if (neighborQuery) {
        exercises = await this.collectSearchExercises({
          ownerUserId: context.ownerUserId,
          queryText: neighborQuery,
          muscleGroupIds: [],
          equipmentTypeId: undefined,
          excludeEquipmentTypeId,
          measurementType: parsed.measurementType,
          limit,
        });
        if (exercises.length > 0) {
          fallback = 'neighbor_query';
        }
      }
    }

    const idsPresent = exercises.filter((item) => Boolean(item.id)).length;

    this.logger.log({
      event: 'ai_coach.search',
      concept: conceptKey,
      resolvedGroupsCount: muscleGroupIds.length,
      strictEquipment: Boolean(equipmentTypeId) && fallback === 'none',
      query: queryText ?? null,
      muscleGroup: parsed.muscleGroup ?? null,
      equipmentType: parsed.equipmentType ?? null,
      resultCount: exercises.length,
      fallback,
    });

    return {
      toolName: 'search_exercises',
      llmPayload: {
        count: exercises.length,
        exercises,
        ...(fallback !== 'none'
          ? {
              fallback,
              hint: 'Filtre équipement trop strict : résultats élargis sans equipmentType. Ne pas réimposer Machine pour un contexte « salle ».',
            }
          : {}),
      },
      outputSummary: {
        count: exercises.length,
        idsPresent,
        query: queryText ?? null,
        muscleGroupId: muscleGroupIds[0] ?? null,
        muscleGroupIds,
        equipmentTypeId: equipmentTypeId ?? null,
        excludeEquipmentTypeId: excludeEquipmentTypeId ?? null,
        fallback,
        concept: conceptKey,
      },
      references: [],
    };
  }

  private async collectSearchExercises(input: {
    ownerUserId: string;
    queryText: string | undefined;
    muscleGroupIds: string[];
    equipmentTypeId: string | undefined;
    excludeEquipmentTypeId: string | undefined;
    measurementType: string | undefined;
    limit: number;
  }): Promise<
    Array<{
      id: string;
      name: string;
      muscle: string;
      equipment: string | null;
      measurementType: string;
    }>
  > {
    const byId = new Map<
      string,
      {
        id: string;
        name: string;
        muscle: string;
        equipment: string | null;
        measurementType: string;
      }
    >();
    const muscleTargets =
      input.muscleGroupIds.length > 0 ? input.muscleGroupIds : [undefined];
    // Répartition équitable quand plusieurs groupes (ex. bras → biceps+triceps).
    const perTarget = Math.max(
      2,
      Math.ceil(input.limit / Math.max(1, muscleTargets.length)),
    );
    const fetchLimit = Math.min(
      input.excludeEquipmentTypeId ? perTarget * 3 : perTarget + 2,
      AI_COACH_SEARCH_EXERCISES_MAX_RESULTS,
    );

    for (const muscleGroupId of muscleTargets) {
      const result = await this.exercisesService.list(input.ownerUserId, {
        search: input.queryText,
        muscleGroupId,
        equipmentTypeId: input.equipmentTypeId,
        measurementType: input.measurementType,
        limit: String(fetchLimit),
      });
      let addedForTarget = 0;
      for (const item of result.data) {
        if (byId.has(item.id)) continue;
        byId.set(item.id, {
          id: item.id,
          name: item.name,
          muscle: item.primaryMuscleGroup.name,
          equipment: item.defaultEquipmentType?.name ?? null,
          measurementType: item.measurementType,
        });
        addedForTarget += 1;
        if (addedForTarget >= perTarget) break;
      }
    }

    // Compléter jusqu’à `limit` si un groupe était pauvre.
    if (byId.size < input.limit) {
      for (const muscleGroupId of muscleTargets) {
        if (byId.size >= input.limit) break;
        const result = await this.exercisesService.list(input.ownerUserId, {
          search: input.queryText,
          muscleGroupId,
          equipmentTypeId: input.equipmentTypeId,
          measurementType: input.measurementType,
          limit: String(
            Math.min(input.limit * 2, AI_COACH_SEARCH_EXERCISES_MAX_RESULTS),
          ),
        });
        for (const item of result.data) {
          if (byId.has(item.id)) continue;
          byId.set(item.id, {
            id: item.id,
            name: item.name,
            muscle: item.primaryMuscleGroup.name,
            equipment: item.defaultEquipmentType?.name ?? null,
            measurementType: item.measurementType,
          });
          if (byId.size >= input.limit) break;
        }
      }
    }

    let exercises = [...byId.values()];

    if (input.excludeEquipmentTypeId && exercises.length > 0) {
      const rows = await this.prisma.exercise.findMany({
        where: { id: { in: exercises.map((item) => item.id) } },
        select: {
          id: true,
          defaultEquipmentTypeId: true,
          compatibleEquipment: { select: { equipmentTypeId: true } },
        },
      });
      const excluded = new Set(
        rows
          .filter(
            (row) =>
              row.defaultEquipmentTypeId === input.excludeEquipmentTypeId ||
              row.compatibleEquipment.some(
                (item) =>
                  item.equipmentTypeId === input.excludeEquipmentTypeId,
              ),
          )
          .map((row) => row.id),
      );
      exercises = exercises.filter((item) => !excluded.has(item.id));
    }

    return exercises.slice(0, input.limit);
  }

  /**
   * Résout un label MuscleGroup → UUID(s).
   * Concepts composites (bras, jambes…) → plusieurs codes référentiels.
   */
  private async resolveMuscleGroupIds(label: string): Promise<string[]> {
    const exact = await this.resolveMuscleGroupId(label);
    if (exact) return [exact];

    const concept = resolveAiCoachMuscleConcept(label);
    if (!concept) return [];

    const ids = await Promise.all(
      concept.map((code) => this.resolveMuscleGroupId(code)),
    );
    return [...new Set(ids.filter((id): id is string => id != null))];
  }

  /** Résout un label/code MuscleGroup vers son UUID (sans exposer le catalogue). */
  private async resolveMuscleGroupId(label: string): Promise<string | null> {
    const needle = normalizeExerciseName(label);
    if (!needle) return null;
    const rows = await this.prisma.muscleGroup.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
    });
    const exact = rows.find(
      (row) =>
        normalizeExerciseName(row.name) === needle ||
        normalizeExerciseName(row.code) === needle ||
        row.code.toLowerCase() === label.trim().toLowerCase(),
    );
    return exact?.id ?? null;
  }

  /** Résout un label/code EquipmentType vers son UUID. */
  private async resolveEquipmentTypeId(label: string): Promise<string | null> {
    const needle = normalizeExerciseName(label);
    if (!needle) return null;
    const rows = await this.prisma.equipmentType.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
    });
    const exact = rows.find(
      (row) =>
        normalizeExerciseName(row.name) === needle ||
        normalizeExerciseName(row.code) === needle ||
        row.code.toLowerCase() === label.trim().toLowerCase(),
    );
    return exact?.id ?? null;
  }

  /** Jalon 8 — permet à l’IA de s’appuyer sur le programme actif pour une proposal program. */
  private async getActiveProgram(
    args: Record<string, unknown>,
    context: AiCoachToolExecutionContext,
  ): Promise<AiCoachToolExecutionResult> {
    getActiveProgramToolArgsSchema.parse(args);
    const active = await this.programsService.getActive(context.ownerUserId);
    return {
      toolName: 'get_active_program',
      llmPayload: active
        ? {
            programId: active.program.id,
            name: active.program.name,
            goal: active.program.goal,
            workoutTemplateCount: active.program.workoutTemplateCount,
          }
        : null,
      outputSummary: { hasActiveProgram: active != null },
      references: [],
    };
  }

  /** Jalon 8 — détail compact d’un programme (sans champs d’audit) pour une proposal program. */
  private async getProgramDetail(
    args: Record<string, unknown>,
    context: AiCoachToolExecutionContext,
  ): Promise<AiCoachToolExecutionResult> {
    const parsed = getProgramDetailToolArgsSchema.parse(args);
    const detail = await this.programsService.getById(
      context.ownerUserId,
      parsed.programId,
    );
    return {
      toolName: 'get_program_detail',
      llmPayload: {
        programId: detail.id,
        name: detail.name,
        goal: detail.goal,
        workoutTemplates: detail.workoutTemplates.slice(0, 12).map((template) => ({
          workoutTemplateId: template.id,
          name: template.name,
          exercises: template.exercises.slice(0, 12).map((exercise) => ({
            exerciseId: exercise.exercise.id,
            name: exercise.exercise.name,
            setCount: exercise.sets.length,
          })),
        })),
      },
      outputSummary: {
        programId: detail.id,
        workoutTemplateCount: detail.workoutTemplates.length,
      },
      references: [],
    };
  }
}
