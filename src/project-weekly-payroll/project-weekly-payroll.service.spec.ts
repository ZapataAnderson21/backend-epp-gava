import { ConflictException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ProjectWeeklyPayrollService } from './project-weekly-payroll.service';

describe('ProjectWeeklyPayrollService', () => {
  const project = {
    findFirst: jest.fn(),
  };
  const week = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  };
  const projectWeeklyPayroll = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const prisma = {
    project,
    week,
    projectWeeklyPayroll,
  } as unknown as PrismaService;
  const service = new ProjectWeeklyPayrollService(prisma);

  const projectRow = {
    projectId: 17,
    startDate: new Date('2026-08-01T00:00:00.000Z'),
    endDate: new Date('2026-08-31T23:59:59.999Z'),
  };
  const weekRow = {
    weekId: 42,
    startDate: new Date('2026-08-17T00:00:00.000Z'),
    endDate: new Date('2026-08-23T23:59:59.999Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    project.findFirst.mockResolvedValue(projectRow);
    week.findUnique.mockResolvedValue(weekRow);
  });

  it('registra un monto manual para un proyecto y una semana', async () => {
    projectWeeklyPayroll.findUnique.mockResolvedValue(null);
    projectWeeklyPayroll.create.mockResolvedValue({
      projectWeeklyPayrollId: 1,
      projectId: 17,
      weekId: 42,
      amount: '3250.50',
      notes: 'Cierre semanal',
      createdAt: new Date(),
      updatedAt: new Date(),
      week: weekRow,
    });

    const result = await service.create({
      projectId: 17,
      weekId: 42,
      amount: 3250.5,
      notes: ' Cierre semanal ',
    });

    expect(projectWeeklyPayroll.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          projectId: 17,
          weekId: 42,
          amount: 3250.5,
          notes: 'Cierre semanal',
        },
      }),
    );
    expect(result.data.amount).toBe(3250.5);
  });

  it('impide registrar dos montos para el mismo proyecto y semana', async () => {
    projectWeeklyPayroll.findUnique.mockResolvedValue({
      projectWeeklyPayrollId: 1,
    });

    await expect(
      service.create({
        projectId: 17,
        weekId: 42,
        amount: 100,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(projectWeeklyPayroll.create).not.toHaveBeenCalled();
  });

  it('lista únicamente las semanas que se superponen al periodo del proyecto', async () => {
    week.findMany.mockResolvedValue([weekRow]);

    const result = await service.findWeeksForProject(17);

    expect(week.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          endDate: { gte: projectRow.startDate },
          startDate: { lte: projectRow.endDate },
        },
      }),
    );
    expect(result.data).toEqual([weekRow]);
  });
});
