/**
 * Jalon 8 — acceptation/refus d’une proposition Coach IA.
 *
 * L’IA ne crée jamais rien directement : ce service revalide intégralement
 * (exercices, équipement, cibles) puis crée de façon déterministe le Program
 * ou le WorkoutTemplate correspondant, dans une transaction. `AiCoachProposal`
 * reste la source de vérité de l’état (PENDING|ACCEPTED|DISMISSED|INVALID).
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AcceptAiCoachProposalResponse,
  DismissAiCoachProposalResponse,
} from '@gym-companion/shared';
import {
  acceptCoachProposalBodySchema,
  coachProgramProposalSchema,
  coachWorkoutProposalSchema,
  computeNextOrderedPosition,
  type AcceptCoachProposalInput,
} from '@gym-companion/validation';
import type { AiCoachProposal } from '@prisma/client';

import { PrismaService } from '../../../database/prisma/prisma.service';
import {
  AiCoachProposalBusinessError,
  toAiCoachProposalSummary,
  validateProposalContext,
} from './ai-coach-proposal-payload';

@Injectable()
export class AiCoachProposalService {
  constructor(private readonly prisma: PrismaService) {}

  async accept(
    proposalId: string,
    userId: string,
    rawBody: unknown,
  ): Promise<AcceptAiCoachProposalResponse> {
    const body = acceptCoachProposalBodySchema.parse(rawBody ?? {});
    const proposal = await this.findOwnedOrThrow(userId, proposalId);

    if (proposal.status === 'ACCEPTED') {
      // Idempotent : ré-accepter renvoie les ressources déjà créées.
      return { proposal: toAiCoachProposalSummary(proposal) };
    }
    if (proposal.status === 'DISMISSED') {
      throw new ConflictException({
        code: 'AI_COACH_PROPOSAL_DISMISSED',
        message:
          'Cette proposition a été refusée et ne peut plus être acceptée.',
      });
    }
    if (proposal.status === 'INVALID') {
      throw new BadRequestException({
        code: 'AI_COACH_PROPOSAL_INVALID',
        message:
          'Cette proposition n’est plus valide (données obsolètes). Demande une nouvelle proposition au Coach.',
      });
    }

    try {
      const updated =
        proposal.kind === 'WORKOUT'
          ? await this.acceptWorkout(userId, proposal, body)
          : await this.acceptProgram(userId, proposal);
      return { proposal: toAiCoachProposalSummary(updated) };
    } catch (error) {
      if (error instanceof AiCoachProposalBusinessError) {
        await this.prisma.aiCoachProposal.updateMany({
          where: { id: proposal.id, status: 'PENDING' },
          data: { status: 'INVALID' },
        });
        throw new BadRequestException({
          code: 'AI_COACH_PROPOSAL_STALE',
          message: error.message,
        });
      }
      throw error;
    }
  }

  async dismiss(
    proposalId: string,
    userId: string,
  ): Promise<DismissAiCoachProposalResponse> {
    const proposal = await this.findOwnedOrThrow(userId, proposalId);

    if (proposal.status === 'DISMISSED') {
      return { proposal: toAiCoachProposalSummary(proposal) };
    }
    if (proposal.status === 'ACCEPTED') {
      throw new ConflictException({
        code: 'AI_COACH_PROPOSAL_ALREADY_ACCEPTED',
        message:
          'Cette proposition a déjà été acceptée et ne peut plus être refusée.',
      });
    }

    const updated = await this.prisma.aiCoachProposal.update({
      where: { id: proposal.id },
      data: { status: 'DISMISSED', dismissedAt: new Date() },
    });
    return { proposal: toAiCoachProposalSummary(updated) };
  }

  private async acceptWorkout(
    userId: string,
    proposal: AiCoachProposal,
    body: AcceptCoachProposalInput,
  ): Promise<AiCoachProposal> {
    if (!body.programId) {
      throw new BadRequestException({
        code: 'AI_COACH_PROPOSAL_PROGRAM_ID_REQUIRED',
        message:
          'programId est requis pour accepter une proposition de séance : un modèle de séance appartient toujours à un programme.',
      });
    }
    const programId = body.programId;

    const program = await this.prisma.program.findFirst({
      where: { id: programId, ownerUserId: userId },
      select: { id: true, archivedAt: true },
    });
    if (!program) {
      throw new NotFoundException({
        code: 'PROGRAM_NOT_FOUND',
        message: 'Programme introuvable.',
      });
    }
    if (program.archivedAt) {
      throw new ForbiddenException({
        code: 'PROGRAM_NOT_EDITABLE',
        message: 'Un programme archivé ne peut pas être modifié.',
      });
    }

    const payload = coachWorkoutProposalSchema.parse(proposal.payloadJson);
    await validateProposalContext(this.prisma, userId, 'WORKOUT', payload, null);

    return this.prisma.$transaction(async (tx) => {
      const existingTemplates = await tx.workoutTemplate.findMany({
        where: { programId },
        select: { positionInProgram: true },
      });
      const position = computeNextOrderedPosition(
        existingTemplates.map((item) => item.positionInProgram),
      );

      const template = await tx.workoutTemplate.create({
        data: {
          ownerUserId: userId,
          programId,
          name: payload.name.trim(),
          description: null,
          estimatedDurationMinutes: payload.estimatedDurationMinutes,
          positionInProgram: position,
          exercises: {
            create: payload.exercises.map((exercise, exerciseIndex) => ({
              exerciseId: exercise.exerciseId,
              position: exerciseIndex,
              equipmentTypeId: exercise.equipmentTypeId,
              notes: exercise.notes,
              sets: {
                create: exercise.sets.map((set, setIndex) => ({
                  position: setIndex,
                  setType: set.setType,
                  targetRepMin: set.targetRepMin,
                  targetRepMax: set.targetRepMax,
                  targetDurationSeconds: set.targetDurationSeconds,
                  targetDistanceMeters: set.targetDistanceMeters,
                  targetWeightKg: set.targetWeightKg,
                  targetIntensityPercent: set.targetIntensityPercent,
                  targetRir: set.targetRir,
                  targetRpe: set.targetRpe,
                  restSeconds: set.restSeconds,
                })),
              },
            })),
          },
        },
      });

      return tx.aiCoachProposal.update({
        where: { id: proposal.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
          createdWorkoutTemplateId: template.id,
        },
      });
    });
  }

  private async acceptProgram(
    userId: string,
    proposal: AiCoachProposal,
  ): Promise<AiCoachProposal> {
    const payload = coachProgramProposalSchema.parse(proposal.payloadJson);
    await validateProposalContext(this.prisma, userId, 'PROGRAM', null, payload);

    return this.prisma.$transaction(async (tx) => {
      // Jalon 8 — la proposal ne peut jamais activer un programme : le
      // programme créé reste DRAFT, l’utilisateur l’active explicitement.
      const program = await tx.program.create({
        data: {
          ownerUserId: userId,
          name: payload.name.trim(),
          description: payload.description,
          goal: payload.goal,
          status: 'DRAFT',
          workoutTemplates: {
            create: payload.workouts.map((workout, workoutIndex) => ({
              ownerUserId: userId,
              name: workout.name.trim(),
              description: null,
              estimatedDurationMinutes: workout.estimatedDurationMinutes,
              positionInProgram: workoutIndex,
              exercises: {
                create: workout.exercises.map((exercise, exerciseIndex) => ({
                  exerciseId: exercise.exerciseId,
                  position: exerciseIndex,
                  equipmentTypeId: exercise.equipmentTypeId,
                  notes: exercise.notes,
                  sets: {
                    create: exercise.sets.map((set, setIndex) => ({
                      position: setIndex,
                      setType: set.setType,
                      targetRepMin: set.targetRepMin,
                      targetRepMax: set.targetRepMax,
                      targetDurationSeconds: set.targetDurationSeconds,
                      targetDistanceMeters: set.targetDistanceMeters,
                      targetWeightKg: set.targetWeightKg,
                      targetIntensityPercent: set.targetIntensityPercent,
                      targetRir: set.targetRir,
                      targetRpe: set.targetRpe,
                      restSeconds: set.restSeconds,
                    })),
                  },
                })),
              },
            })),
          },
        },
        include: {
          workoutTemplates: { orderBy: { positionInProgram: 'asc' } },
        },
      });

      if (payload.schedule && payload.schedule.length > 0) {
        await tx.programScheduleEntry.createMany({
          data: payload.schedule.map((entry) => {
            const template = program.workoutTemplates[entry.workoutIndex];
            if (!template) {
              // Couvert par coachProgramProposalSchema (workoutIndex bornes) ;
              // garde défensive si l’invariant est un jour rompu.
              throw new AiCoachProposalBusinessError(
                'workoutIndex hors bornes dans la planification proposée.',
              );
            }
            return {
              programId: program.id,
              workoutTemplateId: template.id,
              weekday: entry.weekday,
              position: entry.position,
            };
          }),
        });
      }

      return tx.aiCoachProposal.update({
        where: { id: proposal.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
          createdProgramId: program.id,
        },
      });
    });
  }

  private async findOwnedOrThrow(
    userId: string,
    proposalId: string,
  ): Promise<AiCoachProposal> {
    const row = await this.prisma.aiCoachProposal.findFirst({
      where: { id: proposalId, ownerUserId: userId },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'AI_COACH_PROPOSAL_NOT_FOUND',
        message: 'Proposition introuvable.',
      });
    }
    return row;
  }
}
