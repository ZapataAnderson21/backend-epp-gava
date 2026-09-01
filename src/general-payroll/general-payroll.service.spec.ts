import { ConflictException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { GeneralPayrollService } from './general-payroll.service';

describe('GeneralPayrollService', () => {
  describe('findProjectTotals', () => {
    it('calculates the economic-summary total from active project assignments', async () => {
      const payrollProjectFindMany = jest.fn().mockResolvedValue([
        {
          generalPayroll: {
            weekId: 4,
            week: {
              startDate: new Date('2026-08-24T00:00:00.000Z'),
              endDate: new Date('2026-08-30T00:00:00.000Z'),
            },
          },
          entries: [
            {
              generalPayrollEntryId: 10,
              monday: 1,
              tuesday: 1,
              wednesday: 0,
              thursday: 0,
              friday: 0,
              saturday: 0,
              dominical: 0,
              overtimeAmount: 20,
              afpDiscount: 10,
              advanceDiscount: 5,
              payrollWorker: {
                workerId: 7,
                group: 'laborer',
                dailyWage: 100,
                worker: { fullName: 'Ana Pérez', dni: '12345678' },
              },
            },
          ],
        },
      ]);
      const prisma = {
        project: {
          findFirst: jest.fn().mockResolvedValue({
            projectId: 3,
            name: 'Proyecto prueba',
            code: 'P-003',
          }),
        },
        generalPayrollProject: { findMany: payrollProjectFindMany },
      } as unknown as PrismaService;
      const service = new GeneralPayrollService(prisma);

      const response = await service.findProjectTotals(3);

      expect(response.data).toEqual({
        laborerAmount: 205,
        technicianAmount: 0,
        totalAmount: 205,
      });
      expect(payrollProjectFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            entries: expect.objectContaining({ where: { isActive: true } }),
          }),
        }),
      );
    });
  });

  describe('updateProjectWorkers', () => {
    const projectFindFirst = jest.fn();
    const workerCount = jest.fn();
    const entryUpdateMany = jest.fn();
    const transaction = {
      generalPayrollEntry: { updateMany: entryUpdateMany },
    };
    const runTransaction = jest.fn(
      async (operation: (client: typeof transaction) => Promise<void>) =>
        operation(transaction),
    );
    const prisma = {
      generalPayrollProject: { findFirst: projectFindFirst },
      generalPayrollWorker: { count: workerCount },
      $transaction: runTransaction,
    } as unknown as PrismaService;
    const service = new GeneralPayrollService(prisma);

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('requires confirmation before removing a worker with attendance', async () => {
      projectFindFirst.mockResolvedValue({
        generalPayrollId: 5,
        entries: [
          {
            generalPayrollEntryId: 30,
            generalPayrollWorkerId: 12,
            isActive: true,
            monday: 1,
            tuesday: 0,
            wednesday: 0,
            thursday: 0,
            friday: 0,
            saturday: 0,
            dominical: 0,
            overtimeAmount: 0,
            afpDiscount: 0,
            advanceDiscount: 0,
            payrollWorker: { worker: { fullName: 'Ana Pérez' } },
          },
        ],
      });
      workerCount.mockResolvedValue(0);

      await expect(
        service.updateProjectWorkers(8, 22, {
          generalPayrollWorkerIds: [],
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(runTransaction).not.toHaveBeenCalled();
    });

    it('deactivates removed workers and clears their project records after confirmation', async () => {
      projectFindFirst.mockResolvedValue({
        generalPayrollId: 5,
        entries: [
          {
            generalPayrollEntryId: 30,
            generalPayrollWorkerId: 12,
            isActive: true,
            monday: 1,
            tuesday: 0,
            wednesday: 0,
            thursday: 0,
            friday: 0,
            saturday: 0,
            dominical: 0,
            overtimeAmount: 20,
            afpDiscount: 0,
            advanceDiscount: 0,
            payrollWorker: { worker: { fullName: 'Ana Pérez' } },
          },
        ],
      });
      workerCount.mockResolvedValue(0);
      jest
        .spyOn(service, 'findOne')
        .mockResolvedValue({} as Awaited<ReturnType<typeof service.findOne>>);

      await service.updateProjectWorkers(8, 22, {
        generalPayrollWorkerIds: [],
        confirmClearAttendance: true,
      });

      expect(entryUpdateMany).toHaveBeenCalledWith({
        where: {
          generalPayrollProjectId: 22,
          generalPayrollWorkerId: { notIn: [] },
        },
        data: {
          isActive: false,
          monday: 0,
          tuesday: 0,
          wednesday: 0,
          thursday: 0,
          friday: 0,
          saturday: 0,
          dominical: 0,
          overtimeAmount: 0,
          afpDiscount: 0,
          advanceDiscount: 0,
        },
      });
    });
  });

  describe('initialize', () => {
    it('duplicates the previous roster into independent records for the new week', async () => {
      const workerCreateMany = jest.fn().mockResolvedValue({ count: 1 });
      const prisma = {
        week: {
          findUnique: jest.fn().mockResolvedValue({
            weekId: 9,
            startDate: new Date('2026-09-07T00:00:00.000Z'),
          }),
        },
        generalPayroll: {
          upsert: jest
            .fn()
            .mockResolvedValue({ generalPayrollId: 90, weekId: 9 }),
          findFirst: jest.fn().mockResolvedValue({
            generalPayrollId: 80,
            workers: [
              {
                workerId: 7,
                group: 'laborer',
                dailyWage: 85,
                displayOrder: 0,
              },
            ],
          }),
          findUniqueOrThrow: jest
            .fn()
            .mockResolvedValue({ generalPayrollId: 90, weekId: 9 }),
        },
        generalPayrollWorker: {
          count: jest.fn().mockResolvedValue(0),
          createMany: workerCreateMany,
          findMany: jest.fn().mockResolvedValue([]),
        },
        generalPayrollProject: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      } as unknown as PrismaService;
      const service = new GeneralPayrollService(prisma);
      jest
        .spyOn(service, 'findOne')
        .mockResolvedValue({} as Awaited<ReturnType<typeof service.findOne>>);

      await service.initialize(9, { copyPreviousWorkers: true });

      expect(workerCreateMany).toHaveBeenCalledWith({
        data: [
          {
            generalPayrollId: 90,
            workerId: 7,
            group: 'laborer',
            dailyWage: 85,
            displayOrder: 0,
          },
        ],
        skipDuplicates: true,
      });
    });
  });
});
