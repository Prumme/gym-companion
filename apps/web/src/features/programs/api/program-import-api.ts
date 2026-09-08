import type {
  ProgramDetail,
  ProgramImportValidateResponse,
} from '@gym-companion/shared';
import type { ProgramImportPayloadV1 } from '@gym-companion/validation';

import { apiFetch } from '@/lib/api/client';

export async function validateProgramImport(
  payload: ProgramImportPayloadV1 | unknown,
): Promise<ProgramImportValidateResponse> {
  const response = await apiFetch<{ data: ProgramImportValidateResponse }>(
    '/api/v1/program-imports/validate',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  return response.data;
}

export async function importProgramFromJson(
  payload: ProgramImportPayloadV1 | unknown,
): Promise<ProgramDetail> {
  const response = await apiFetch<{ data: ProgramDetail }>(
    '/api/v1/program-imports',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  return response.data;
}
