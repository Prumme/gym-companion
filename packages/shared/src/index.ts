export type ApiSuccessResponse<T> = {
  data: T;
};

export type ApiErrorResponse = {
  error: {
    code: string;
    message: string;
    details?: unknown;
    fieldErrors?: Record<string, string[]>;
    requestId?: string;
  };
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type ApiListResponse<T> = {
  data: T[];
  pagination: PaginationMeta;
};

export type HealthStatus = 'ok' | 'degraded' | 'error';

export type HealthCheckResult = {
  status: HealthStatus;
  checks?: Record<
    string,
    {
      status: HealthStatus;
      message?: string;
    }
  >;
};

export type UserStatus = 'PENDING' | 'ACTIVE' | 'DISABLED' | 'DELETION_PENDING';
export type UserRole = 'USER' | 'ADMIN';
export type WeightUnit = 'KG' | 'LB';
export type DistanceUnit = 'KM' | 'MI';
export type TrainingGoal =
  | 'ENDURANCE'
  | 'HYPERTROPHY'
  | 'STRENGTH'
  | 'GENERAL_FITNESS';
export type ExperienceLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export type EffortTrackingMode = 'NONE' | 'RIR' | 'RPE';

export function createSuccessResponse<T>(data: T): ApiSuccessResponse<T> {
  return { data };
}
