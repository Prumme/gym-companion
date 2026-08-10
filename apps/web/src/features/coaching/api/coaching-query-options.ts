import { queryOptions } from '@tanstack/react-query';

import {
  getLoadRecommendation,
  getPlateauAnalysis,
  getCoachingOverview,
  getExerciseCoachSummary,
  getAiCoachConversation,
  listAiCoachConversations,
  listLoadRecommendationDecisions,
} from './coaching-api';
import { coachingQueryKeys } from './coaching-query-keys';

export function loadRecommendationQueryOptions(
  workoutTemplateExerciseId: string,
) {
  return queryOptions({
    queryKey: coachingQueryKeys.loadRecommendation(workoutTemplateExerciseId),
    queryFn: () => getLoadRecommendation(workoutTemplateExerciseId),
    staleTime: 30_000,
  });
}

export function loadRecommendationDecisionsQueryOptions(
  workoutTemplateExerciseId: string,
) {
  return queryOptions({
    queryKey: coachingQueryKeys.loadRecommendationDecisions(
      workoutTemplateExerciseId,
    ),
    queryFn: () =>
      listLoadRecommendationDecisions(workoutTemplateExerciseId, { limit: 10 }),
    staleTime: 30_000,
  });
}

export function plateauAnalysisQueryOptions(
  exerciseId: string,
  filters: { equipmentId?: string } = {},
) {
  return queryOptions({
    queryKey: coachingQueryKeys.plateauAnalysis(exerciseId, filters),
    queryFn: () => getPlateauAnalysis(exerciseId, filters),
    staleTime: 30_000,
  });
}

export function exerciseCoachSummaryQueryOptions(
  exerciseId: string,
  filters: { equipmentId?: string; from?: string; to?: string } = {},
) {
  return queryOptions({
    queryKey: coachingQueryKeys.exerciseSummary(exerciseId, filters),
    queryFn: () => getExerciseCoachSummary(exerciseId, filters),
    staleTime: 30_000,
  });
}

export function coachingOverviewQueryOptions() {
  return queryOptions({
    queryKey: coachingQueryKeys.overview(),
    queryFn: () => getCoachingOverview(),
    staleTime: 30_000,
  });
}

export function aiCoachConversationsQueryOptions() {
  return queryOptions({
    queryKey: coachingQueryKeys.conversations(),
    queryFn: () => listAiCoachConversations({ limit: 20 }),
    staleTime: 15_000,
  });
}

export function aiCoachConversationQueryOptions(conversationId: string) {
  return queryOptions({
    queryKey: coachingQueryKeys.conversation(conversationId),
    queryFn: () => getAiCoachConversation(conversationId),
    staleTime: 5_000,
  });
}
