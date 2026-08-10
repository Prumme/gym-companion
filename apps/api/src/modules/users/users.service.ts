import { Injectable, NotFoundException } from '@nestjs/common';
import { updateProfileSchema } from '@gym-companion/validation';

import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user || !user.profile) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Utilisateur introuvable.',
      });
    }

    return this.toMeResponse(user);
  }

  async updateProfile(userId: string, input: unknown) {
    const data = updateProfileSchema.parse(input);

    const profile = await this.prisma.userProfile.update({
      where: { userId },
      data: {
        displayName: data.displayName,
        timezone: data.timezone,
        weightUnit: data.weightUnit,
        distanceUnit: data.distanceUnit,
        primaryGoal: data.primaryGoal,
        experienceLevel: data.experienceLevel,
        effortTrackingMode: data.effortTrackingMode,
        heightCm: data.heightCm === undefined ? undefined : data.heightCm,
        currentWeightKg:
          data.currentWeightKg === undefined ? undefined : data.currentWeightKg,
        weeklyTrainingTarget: data.weeklyTrainingTarget,
        defaultWorkoutDurationMinutes: data.defaultWorkoutDurationMinutes,
      },
    });

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { profile: true },
    });

    return this.toMeResponse({ ...user, profile });
  }

  private toMeResponse(user: {
    id: string;
    email: string;
    status: string;
    role: string;
    profile: {
      displayName: string;
      timezone: string;
      weightUnit: string;
      distanceUnit: string;
      primaryGoal: string;
      experienceLevel: string;
      effortTrackingMode: string;
      heightCm: { toNumber(): number } | null;
      currentWeightKg: { toNumber(): number } | null;
      weeklyTrainingTarget: number | null;
      defaultWorkoutDurationMinutes: number | null;
    } | null;
  }) {
    if (!user.profile) {
      throw new NotFoundException({
        code: 'PROFILE_NOT_FOUND',
        message: 'Profil introuvable.',
      });
    }

    return {
      id: user.id,
      email: user.email,
      status: user.status,
      role: user.role,
      profile: {
        displayName: user.profile.displayName,
        timezone: user.profile.timezone,
        weightUnit: user.profile.weightUnit,
        distanceUnit: user.profile.distanceUnit,
        primaryGoal: user.profile.primaryGoal,
        experienceLevel: user.profile.experienceLevel,
        effortTrackingMode: user.profile.effortTrackingMode,
        heightCm: user.profile.heightCm ? user.profile.heightCm.toNumber() : null,
        currentWeightKg: user.profile.currentWeightKg
          ? user.profile.currentWeightKg.toNumber()
          : null,
        weeklyTrainingTarget: user.profile.weeklyTrainingTarget,
        defaultWorkoutDurationMinutes: user.profile.defaultWorkoutDurationMinutes,
      },
      ai: {
        available: this.config.aiCoachAvailable,
      },
    };
  }
}
