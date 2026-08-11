import type {
  AcceptAiCoachProposalResponse,
  AiCoachConversationDetail,
  AiCoachConversationListItem,
  ApiCursorListResponse,
  CoachingOverview,
  DecideLoadRecommendationResult,
  DismissAiCoachProposalResponse,
  ExerciseCoachExplanationResponse,
  ExerciseCoachSummary,
  LoadRecommendation,
  LoadRecommendationDecisionListResponse,
  PlateauAnalysis,
  SendAiCoachMessageResponse,
} from '@gym-companion/shared';
import type {
  AcceptCoachProposalInput,
  DecideLoadRecommendationInput,
} from '@gym-companion/validation';

import { apiFetch } from '@/lib/api/client';

export async function getLoadRecommendation(
  workoutTemplateExerciseId: string,
): Promise<LoadRecommendation> {
  const response = await apiFetch<{ data: LoadRecommendation }>(
    `/api/v1/coaching/workout-template-exercises/${encodeURIComponent(workoutTemplateExerciseId)}/load-recommendation`,
  );
  return response.data;
}

export async function decideLoadRecommendation(
  workoutTemplateExerciseId: string,
  input: DecideLoadRecommendationInput,
): Promise<DecideLoadRecommendationResult> {
  const response = await apiFetch<{ data: DecideLoadRecommendationResult }>(
    `/api/v1/coaching/workout-template-exercises/${encodeURIComponent(workoutTemplateExerciseId)}/load-recommendation/decision`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  return response.data;
}

export async function listLoadRecommendationDecisions(
  workoutTemplateExerciseId: string,
  params: { cursor?: string; limit?: number } = {},
): Promise<LoadRecommendationDecisionListResponse> {
  const search = new URLSearchParams();
  if (params.cursor) search.set('cursor', params.cursor);
  if (params.limit != null) search.set('limit', String(params.limit));
  const suffix = search.toString();
  return apiFetch<LoadRecommendationDecisionListResponse>(
    `/api/v1/coaching/workout-template-exercises/${encodeURIComponent(workoutTemplateExerciseId)}/load-recommendation-decisions${suffix ? `?${suffix}` : ''}`,
  );
}

export async function getPlateauAnalysis(
  exerciseId: string,
  params: { equipmentId?: string } = {},
): Promise<PlateauAnalysis> {
  const search = new URLSearchParams();
  if (params.equipmentId) search.set('equipmentId', params.equipmentId);
  const suffix = search.toString();
  const response = await apiFetch<{ data: PlateauAnalysis }>(
    `/api/v1/coaching/exercises/${encodeURIComponent(exerciseId)}/plateau-analysis${suffix ? `?${suffix}` : ''}`,
  );
  return response.data;
}

export async function getExerciseCoachSummary(
  exerciseId: string,
  params: { equipmentId?: string; from?: string; to?: string } = {},
): Promise<ExerciseCoachSummary> {
  const search = new URLSearchParams();
  if (params.equipmentId) search.set('equipmentId', params.equipmentId);
  if (params.from) search.set('from', params.from);
  if (params.to) search.set('to', params.to);
  const suffix = search.toString();
  const response = await apiFetch<{ data: ExerciseCoachSummary }>(
    `/api/v1/coaching/exercises/${encodeURIComponent(exerciseId)}/summary${suffix ? `?${suffix}` : ''}`,
  );
  return response.data;
}

export async function getCoachingOverview(): Promise<CoachingOverview> {
  const response = await apiFetch<{ data: CoachingOverview }>(
    '/api/v1/coaching/overview',
  );
  return response.data;
}

export async function generateExerciseCoachExplanation(
  exerciseId: string,
  input: { focus?: 'GENERAL' | 'LOAD' | 'PROGRESS' | 'PLATEAU' } = {},
): Promise<ExerciseCoachExplanationResponse> {
  const response = await apiFetch<{ data: ExerciseCoachExplanationResponse }>(
    `/api/v1/coaching/exercises/${encodeURIComponent(exerciseId)}/explanation`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  return response.data;
}

export async function createAiCoachConversation(input: {
  exerciseId?: string;
} = {}): Promise<AiCoachConversationDetail> {
  const response = await apiFetch<{ data: AiCoachConversationDetail }>(
    '/api/v1/coaching/conversations',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  return response.data;
}

export async function listAiCoachConversations(params: {
  cursor?: string;
  limit?: number;
} = {}): Promise<ApiCursorListResponse<AiCoachConversationListItem>> {
  const search = new URLSearchParams();
  if (params.cursor) search.set('cursor', params.cursor);
  if (params.limit != null) search.set('limit', String(params.limit));
  const suffix = search.toString();
  return apiFetch<ApiCursorListResponse<AiCoachConversationListItem>>(
    `/api/v1/coaching/conversations${suffix ? `?${suffix}` : ''}`,
  );
}

export async function getAiCoachConversation(
  conversationId: string,
): Promise<AiCoachConversationDetail> {
  const response = await apiFetch<{ data: AiCoachConversationDetail }>(
    `/api/v1/coaching/conversations/${encodeURIComponent(conversationId)}`,
  );
  return response.data;
}

export async function sendAiCoachMessage(
  conversationId: string,
  input: { content: string; clientCommandId: string },
): Promise<SendAiCoachMessageResponse> {
  const response = await apiFetch<{ data: SendAiCoachMessageResponse }>(
    `/api/v1/coaching/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  return response.data;
}

export async function archiveAiCoachConversation(
  conversationId: string,
): Promise<{ id: string; archivedAt: string }> {
  const response = await apiFetch<{
    data: { id: string; archivedAt: string };
  }>(
    `/api/v1/coaching/conversations/${encodeURIComponent(conversationId)}/archive`,
    { method: 'POST', body: JSON.stringify({}) },
  );
  return response.data;
}

export async function acceptAiCoachProposal(
  proposalId: string,
  input: AcceptCoachProposalInput = {},
): Promise<AcceptAiCoachProposalResponse> {
  const response = await apiFetch<{ data: AcceptAiCoachProposalResponse }>(
    `/api/v1/coaching/proposals/${encodeURIComponent(proposalId)}/accept`,
    { method: 'POST', body: JSON.stringify(input) },
  );
  return response.data;
}

export async function dismissAiCoachProposal(
  proposalId: string,
): Promise<DismissAiCoachProposalResponse> {
  const response = await apiFetch<{ data: DismissAiCoachProposalResponse }>(
    `/api/v1/coaching/proposals/${encodeURIComponent(proposalId)}/dismiss`,
    { method: 'POST', body: JSON.stringify({}) },
  );
  return response.data;
}
