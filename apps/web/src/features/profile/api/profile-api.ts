import { apiFetch } from '@/lib/api/client';
import type { UpdateProfileInput } from '@gym-companion/validation';

export type MeResponse = {
  data: {
    id: string;
    email: string;
    status: string;
    role: string;
    profile: {
      displayName: string;
      timezone: string;
      weightUnit: 'KG' | 'LB';
      distanceUnit: 'KM' | 'MI';
      primaryGoal: 'ENDURANCE' | 'HYPERTROPHY' | 'STRENGTH' | 'GENERAL_FITNESS';
      experienceLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
      effortTrackingMode: 'NONE' | 'RIR' | 'RPE';
      heightCm: number | null;
      currentWeightKg: number | null;
      weeklyTrainingTarget: number | null;
      defaultWorkoutDurationMinutes: number | null;
    };
  };
};

export function getMe() {
  return apiFetch<MeResponse>('/api/v1/me');
}

export function updateProfile(input: UpdateProfileInput) {
  return apiFetch<MeResponse>('/api/v1/me/profile', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
