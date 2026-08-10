import type {
  PersonalRecord,
  PersonalRecordListResponse,
} from '@gym-companion/shared';
import type { PersonalRecordsQuery } from '@gym-companion/validation';

import { apiFetch } from '@/lib/api/client';

export type PersonalRecordsListQuery = Partial<PersonalRecordsQuery> & {
  cursor?: string;
  limit?: number;
};

function appendIfPresent(
  params: URLSearchParams,
  key: string,
  value: string | number | boolean | undefined,
) {
  if (value === undefined || value === '') {
    return;
  }
  params.set(key, String(value));
}

export function buildPersonalRecordsSearchParams(
  query: PersonalRecordsListQuery,
): URLSearchParams {
  const params = new URLSearchParams();
  appendIfPresent(params, 'exerciseId', query.exerciseId);
  appendIfPresent(params, 'recordType', query.recordType);
  appendIfPresent(params, 'cursor', query.cursor);
  appendIfPresent(params, 'limit', query.limit);
  return params;
}

export async function listPersonalRecords(
  query: PersonalRecordsListQuery = {},
): Promise<PersonalRecordListResponse> {
  const params = buildPersonalRecordsSearchParams(query);
  const suffix = params.toString();
  return apiFetch<PersonalRecordListResponse>(
    `/api/v1/personal-records${suffix ? `?${suffix}` : ''}`,
  );
}

export async function listExercisePersonalRecords(
  exerciseId: string,
): Promise<PersonalRecord[]> {
  const response = await apiFetch<{ data: PersonalRecord[] }>(
    `/api/v1/exercises/${exerciseId}/personal-records`,
  );
  return response.data;
}
