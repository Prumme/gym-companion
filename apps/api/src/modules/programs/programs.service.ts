import { Injectable } from '@nestjs/common';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { ProgramDetail, ProgramListResponse } from '@gym-companion/shared';
import type { Prisma } from '@prisma/client';
import {
  buildProgramCursorFilter,
  compactWorkoutTemplatePositions,
  computeNextWorkoutTemplatePosition,
  createProgramSchema,
  createWorkoutTemplateSchema,
  decodeProgramCursor,
  encodeProgramCursor,
  listProgramsQuerySchema,
  reorderWorkoutTemplatesSchema,
  updateProgramSchema,
  updateWorkoutTemplateSchema,
  validateWorkoutTemplateReorder,
} from '@gym-companion/validation';

import { PrismaService } from '../../database/prisma/prisma.service';
import {
  toProgramDetail,
  toProgramListItem,
  type ProgramRow,
} from './programs.mapper';

const programDetailInclude = {
  workoutTemplates: {
    orderBy: { positionInProgram: 'asc' as const },
  },
  _count: { select: { workoutTemplates: true } },
} satisfies Prisma.ProgramInclude;

@Injectable()
export class ProgramsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    userId: string,
    rawQuery: Record<string, string | undefined>,
  ): Promise<ProgramListResponse> {
    let query: ReturnType<typeof listProgramsQuerySchema.parse>;
    try {
      query = listProgramsQuerySchema.parse(rawQuery);
    } catch {
      throw new BadRequestException({
        code: 'PROGRAM_INVALID_LIST_QUERY',
        message: 'Paramètres de liste invalides.',
      });
    }

    let cursorFilter: ReturnType<typeof buildProgramCursorFilter> | undefined;
    if (query.cursor) {
      try {
        cursorFilter = buildProgramCursorFilter(decodeProgramCursor(query.cursor));
      } catch {
        throw new BadRequestException({
          code: 'PROGRAM_INVALID_CURSOR',
          message: 'Cursor de pagination invalide.',
        });
      }
    }

    const filters: Prisma.ProgramWhereInput[] = [{ ownerUserId: userId }];
    if (!query.includeArchived) {
      filters.push({ archivedAt: null });
    }
    if (cursorFilter) {
      filters.push(cursorFilter);
    }

    const rows = await this.prisma.program.findMany({
      where: { AND: filters },
      include: { _count: { select: { workoutTemplates: true } } },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });

    const hasMore = rows.length > query.limit;
    const pageRows = hasMore ? rows.slice(0, query.limit) : rows;
    const last = pageRows[pageRows.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeProgramCursor({
            version: 1,
            updatedAt: last.updatedAt.toISOString(),
            id: last.id,
          })
        : null;

    return {
      data: pageRows.map((row) => toProgramListItem(row as ProgramRow)),
      pagination: { nextCursor, hasMore },
    };
  }

  async getById(userId: string, programId: string): Promise<ProgramDetail> {
    const row = await this.findOwnedOrThrow(userId, programId);
    return toProgramDetail(row);
  }

  async create(userId: string, input: unknown): Promise<ProgramDetail> {
    const data = createProgramSchema.parse(input);
    const created = await this.prisma.program.create({
      data: {
        ownerUserId: userId,
        name: data.name.trim(),
        description: data.description ?? null,
        goal: data.goal,
        status: 'DRAFT',
      },
      include: programDetailInclude,
    });
    return toProgramDetail(created as ProgramRow);
  }

  async update(
    userId: string,
    programId: string,
    input: unknown,
  ): Promise<ProgramDetail> {
    const data = updateProgramSchema.parse(input);
    const existing = await this.findOwnedOrThrow(userId, programId);
    this.assertEditable(existing);

    const updated = await this.prisma.program.update({
      where: { id: programId },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.goal !== undefined ? { goal: data.goal } : {}),
      },
      include: programDetailInclude,
    });
    return toProgramDetail(updated as ProgramRow);
  }

  async archive(userId: string, programId: string): Promise<ProgramDetail> {
    const existing = await this.findOwnedOrThrow(userId, programId);
    if (existing.archivedAt) {
      throw new BadRequestException({
        code: 'PROGRAM_ALREADY_ARCHIVED',
        message: 'Ce programme est déjà archivé.',
      });
    }

    const archived = await this.prisma.program.update({
      where: { id: programId },
      data: {
        archivedAt: new Date(),
        status: 'ARCHIVED',
      },
      include: programDetailInclude,
    });
    return toProgramDetail(archived as ProgramRow);
  }

  async restore(userId: string, programId: string): Promise<ProgramDetail> {
    const existing = await this.findOwnedOrThrow(userId, programId);
    if (!existing.archivedAt) {
      throw new BadRequestException({
        code: 'PROGRAM_NOT_ARCHIVED',
        message: 'Ce programme n’est pas archivé.',
      });
    }

    const restored = await this.prisma.program.update({
      where: { id: programId },
      data: {
        archivedAt: null,
        status: 'DRAFT',
      },
      include: programDetailInclude,
    });
    return toProgramDetail(restored as ProgramRow);
  }

  async createWorkoutTemplate(
    userId: string,
    programId: string,
    input: unknown,
  ): Promise<ProgramDetail> {
    const data = createWorkoutTemplateSchema.parse(input);
    const program = await this.findOwnedOrThrow(userId, programId);
    this.assertEditable(program);

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.workoutTemplate.findMany({
        where: { programId },
        select: { positionInProgram: true },
        orderBy: { positionInProgram: 'asc' },
      });
      const position = computeNextWorkoutTemplatePosition(
        existing.map((item) => item.positionInProgram),
      );

      await tx.workoutTemplate.create({
        data: {
          ownerUserId: userId,
          programId,
          name: data.name.trim(),
          description: data.description ?? null,
          estimatedDurationMinutes: data.estimatedDurationMinutes ?? null,
          positionInProgram: position,
        },
      });
    });

    return this.getById(userId, programId);
  }

  async updateWorkoutTemplate(
    userId: string,
    programId: string,
    workoutTemplateId: string,
    input: unknown,
  ): Promise<ProgramDetail> {
    const data = updateWorkoutTemplateSchema.parse(input);
    const program = await this.findOwnedOrThrow(userId, programId);
    this.assertEditable(program);
    await this.findTemplateInProgramOrThrow(programId, workoutTemplateId);

    await this.prisma.workoutTemplate.update({
      where: { id: workoutTemplateId },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.estimatedDurationMinutes !== undefined
          ? { estimatedDurationMinutes: data.estimatedDurationMinutes }
          : {}),
      },
    });

    return this.getById(userId, programId);
  }

  async deleteWorkoutTemplate(
    userId: string,
    programId: string,
    workoutTemplateId: string,
  ): Promise<ProgramDetail> {
    const program = await this.findOwnedOrThrow(userId, programId);
    this.assertEditable(program);
    await this.findTemplateInProgramOrThrow(programId, workoutTemplateId);

    await this.prisma.$transaction(async (tx) => {
      await tx.workoutTemplate.delete({ where: { id: workoutTemplateId } });

      const remaining = await tx.workoutTemplate.findMany({
        where: { programId },
        orderBy: { positionInProgram: 'asc' },
        select: { id: true },
      });
      const compacted = compactWorkoutTemplatePositions(
        remaining.map((item) => item.id),
      );

      // Décale temporairement pour respecter l’unicité (programId, position).
      for (const [index, item] of compacted.entries()) {
        await tx.workoutTemplate.update({
          where: { id: item.id },
          data: { positionInProgram: -(index + 1) },
        });
      }
      for (const item of compacted) {
        await tx.workoutTemplate.update({
          where: { id: item.id },
          data: { positionInProgram: item.position },
        });
      }
    });

    return this.getById(userId, programId);
  }

  async reorderWorkoutTemplates(
    userId: string,
    programId: string,
    input: unknown,
  ): Promise<ProgramDetail> {
    const data = reorderWorkoutTemplatesSchema.parse(input);
    const program = await this.findOwnedOrThrow(userId, programId);
    this.assertEditable(program);

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.workoutTemplate.findMany({
        where: { programId },
        select: { id: true },
        orderBy: { positionInProgram: 'asc' },
      });
      const validation = validateWorkoutTemplateReorder(
        data.workoutTemplateIds,
        existing.map((item) => item.id),
      );
      if (!validation.ok) {
        const messages: Record<typeof validation.code, string> = {
          WORKOUT_TEMPLATE_DUPLICATE_IN_ORDER:
            'La liste d’ordre contient des doublons.',
          WORKOUT_TEMPLATE_ORDER_INCOMPLETE:
            'La liste d’ordre doit contenir tous les modèles du programme.',
          WORKOUT_TEMPLATE_INVALID_ORDER:
            'La liste d’ordre contient un modèle inconnu ou étranger.',
        };
        throw new BadRequestException({
          code: validation.code,
          message: messages[validation.code],
        });
      }

      const compacted = compactWorkoutTemplatePositions(data.workoutTemplateIds);
      for (const [index, item] of compacted.entries()) {
        await tx.workoutTemplate.update({
          where: { id: item.id },
          data: { positionInProgram: -(index + 1) },
        });
      }
      for (const item of compacted) {
        await tx.workoutTemplate.update({
          where: { id: item.id },
          data: { positionInProgram: item.position },
        });
      }
    });

    return this.getById(userId, programId);
  }

  private async findOwnedOrThrow(
    userId: string,
    programId: string,
  ): Promise<ProgramRow> {
    const row = await this.prisma.program.findUnique({
      where: { id: programId },
      include: programDetailInclude,
    });
    if (!row || row.ownerUserId !== userId) {
      throw new NotFoundException({
        code: 'PROGRAM_NOT_FOUND',
        message: 'Programme introuvable.',
      });
    }
    return row as ProgramRow;
  }

  private assertEditable(program: ProgramRow) {
    if (program.archivedAt) {
      throw new ForbiddenException({
        code: 'PROGRAM_NOT_EDITABLE',
        message: 'Un programme archivé ne peut pas être modifié.',
      });
    }
  }

  private async findTemplateInProgramOrThrow(
    programId: string,
    workoutTemplateId: string,
  ) {
    const template = await this.prisma.workoutTemplate.findFirst({
      where: { id: workoutTemplateId, programId },
    });
    if (!template) {
      throw new NotFoundException({
        code: 'WORKOUT_TEMPLATE_NOT_FOUND',
        message: 'Modèle de séance introuvable.',
      });
    }
    return template;
  }
}
