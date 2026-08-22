import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ProjectWeeklyPayroll, Week } from 'src/generated/prisma';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProjectWeeklyPayrollDto } from './dto/create-project-weekly-payroll.dto';
import { UpdateProjectWeeklyPayrollDto } from './dto/update-project-weekly-payroll.dto';

type PayrollWithOptionalWeek = ProjectWeeklyPayroll & {
  week?: Pick<Week, 'weekId' | 'startDate' | 'endDate'>;
};

@Injectable()
export class ProjectWeeklyPayrollService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByProject(projectId: number) {
    await this.ensureProject(projectId);

    const payrolls = await this.prisma.projectWeeklyPayroll.findMany({
      where: { projectId },
      include: {
        week: {
          select: {
            weekId: true,
            startDate: true,
            endDate: true,
          },
        },
      },
      orderBy: { week: { startDate: 'desc' } },
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Planillas semanales obtenidas exitosamente.',
      data: payrolls.map((payroll) => this.serializePayroll(payroll)),
    };
  }

  async findWeeksForProject(projectId: number) {
    const project = await this.ensureProject(projectId);

    const weeks = await this.prisma.week.findMany({
      where: {
        ...(project.startDate ? { endDate: { gte: project.startDate } } : {}),
        ...(project.endDate ? { startDate: { lte: project.endDate } } : {}),
      },
      select: {
        weekId: true,
        startDate: true,
        endDate: true,
      },
      orderBy: { startDate: 'desc' },
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Semanas disponibles obtenidas exitosamente.',
      data: weeks,
    };
  }

  async create(dto: CreateProjectWeeklyPayrollDto) {
    const project = await this.ensureProject(dto.projectId);
    const week = await this.ensureWeek(dto.weekId);
    this.ensureWeekBelongsToProjectPeriod(project, week);

    const existing = await this.prisma.projectWeeklyPayroll.findUnique({
      where: {
        projectId_weekId: {
          projectId: dto.projectId,
          weekId: dto.weekId,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        'Ya existe una planilla registrada para este proyecto y semana.',
      );
    }

    const payroll = await this.prisma.projectWeeklyPayroll.create({
      data: {
        projectId: dto.projectId,
        weekId: dto.weekId,
        amount: dto.amount,
        notes: this.cleanNotes(dto.notes),
      },
      include: {
        week: {
          select: {
            weekId: true,
            startDate: true,
            endDate: true,
          },
        },
      },
    });

    return {
      statusCode: HttpStatus.CREATED,
      message: 'Planilla semanal registrada exitosamente.',
      data: this.serializePayroll(payroll),
    };
  }

  async update(
    projectWeeklyPayrollId: number,
    dto: UpdateProjectWeeklyPayrollDto,
  ) {
    await this.ensurePayroll(projectWeeklyPayrollId);

    const payroll = await this.prisma.projectWeeklyPayroll.update({
      where: { projectWeeklyPayrollId },
      data: {
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.notes !== undefined
          ? { notes: this.cleanNotes(dto.notes) }
          : {}),
      },
      include: {
        week: {
          select: {
            weekId: true,
            startDate: true,
            endDate: true,
          },
        },
      },
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Planilla semanal actualizada exitosamente.',
      data: this.serializePayroll(payroll),
    };
  }

  async remove(projectWeeklyPayrollId: number) {
    await this.ensurePayroll(projectWeeklyPayrollId);

    const payroll = await this.prisma.projectWeeklyPayroll.delete({
      where: { projectWeeklyPayrollId },
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Planilla semanal eliminada exitosamente.',
      data: this.serializePayroll(payroll),
    };
  }

  private async ensureProject(projectId: number) {
    const project = await this.prisma.project.findFirst({
      where: { projectId, deletedAt: null },
      select: {
        projectId: true,
        startDate: true,
        endDate: true,
      },
    });

    if (!project) {
      throw new NotFoundException('No se encontró el proyecto.');
    }

    return project;
  }

  private async ensureWeek(weekId: number) {
    const week = await this.prisma.week.findUnique({
      where: { weekId },
      select: {
        weekId: true,
        startDate: true,
        endDate: true,
      },
    });

    if (!week) {
      throw new NotFoundException('No se encontró la semana.');
    }

    return week;
  }

  private async ensurePayroll(projectWeeklyPayrollId: number) {
    const payroll = await this.prisma.projectWeeklyPayroll.findUnique({
      where: { projectWeeklyPayrollId },
    });

    if (!payroll) {
      throw new NotFoundException('No se encontró la planilla semanal.');
    }

    return payroll;
  }

  private ensureWeekBelongsToProjectPeriod(
    project: { startDate: Date | null; endDate: Date | null },
    week: { startDate: Date; endDate: Date },
  ) {
    const startsAfterProject =
      project.endDate && week.startDate > project.endDate;
    const endsBeforeProject =
      project.startDate && week.endDate < project.startDate;

    if (startsAfterProject || endsBeforeProject) {
      throw new BadRequestException(
        'La semana seleccionada está fuera del periodo del proyecto.',
      );
    }
  }

  private cleanNotes(notes?: string) {
    const cleaned = notes?.trim();
    return cleaned ? cleaned : null;
  }

  private serializePayroll<T extends PayrollWithOptionalWeek>(payroll: T) {
    return {
      ...payroll,
      amount: Number(payroll.amount),
    };
  }
}
