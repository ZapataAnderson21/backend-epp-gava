import { BadRequestException, ConflictException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from 'src/prisma/prisma.service';
import { GeneralPayrollService } from './general-payroll.service';
import { GeneralPayrollExcelService } from './general-payroll-excel.service';
import { GeneralPayrollWorkerGroupDto } from './dto/configure-general-payroll.dto';

const attendance = {
  monday: 1,
  tuesday: 0,
  wednesday: 0,
  thursday: 0,
  friday: 0,
  saturday: 0,
  dominical: 1,
  overtimeAmount: 20,
  afpDiscount: 10,
  advanceDiscount: 5,
};
const worker = {
  generalPayrollWorkerId: 15,
  workerId: 7,
  group: 'laborer',
  displayOrder: 0,
  dailyWage: 100,
  additionalAmount: 12,
  liquidationAmount: 8,
  sundayDinnerAmount: 5,
  worker: { workerId: 7, fullName: 'Ana Pérez', dni: '01234567' },
};
const services = {
  generalPayrollProjectId: 11,
  generalPayrollId: 1,
  projectId: null,
  project: null,
  locationType: 'services',
  displayOrder: 0,
  entries: [
    {
      generalPayrollEntryId: 20,
      generalPayrollProjectId: 11,
      generalPayrollWorkerId: 15,
      isActive: true,
      ...attendance,
    },
  ],
};
const payroll = {
  generalPayrollId: 1,
  weekId: 9,
  week: {
    weekId: 9,
    startDate: new Date('2026-09-14'),
    endDate: new Date('2026-09-20'),
  },
  workers: [worker],
  projects: [services],
};

describe('Servicios payroll location', () => {
  it('counts Services payments without counting it as a project', async () => {
    const prisma = {
      week: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ ...payroll.week, generalPayroll: payroll }]),
      },
    } as unknown as PrismaService;
    const result = await new GeneralPayrollService(prisma).findWeeks();
    expect(result.data[0]).toMatchObject({
      projectCount: 0,
      locationCount: 1,
      includesServices: true,
      totalAmount: 230,
    });
  });

  it.each([false, true])(
    'exports Services, formulas and General totals (colliding project: %s)',
    async (collision) => {
      const projects = collision
        ? [
            {
              ...services,
              generalPayrollProjectId: 12,
              projectId: 3,
              locationType: 'project',
              project: {
                projectId: 3,
                code: 'SERVICIOS',
                name: 'Proyecto real',
              },
              entries: [],
            },
            services,
          ]
        : [services];
      const prisma = {
        generalPayroll: {
          findUnique: jest.fn().mockResolvedValue({ ...payroll, projects }),
        },
      } as unknown as PrismaService;
      const result = await new GeneralPayrollExcelService(
        prisma,
      ).generateWeekWorkbook(9);
      const book = new ExcelJS.Workbook();
      await book.xlsx.load(result.buffer);
      const sheet = book.getWorksheet('Servicios')!;
      expect(sheet).toBeDefined();
      expect(sheet.getCell('A1').value).toBe('PLANILLA DE SERVICIOS');
      expect(sheet.getCell('K7').formula).toBe('SUM(D7:J7)');
      expect(sheet.getCell('N7').formula).toBe('(K7*L7)+M7');
      expect(sheet.getCell('Q7').formula).toBe('N7-O7-P7');
      expect(sheet.getCell('Q7').result).toBe(205);
      expect(sheet.getCell('D7').numFmt).toBe('0');
      const general = book.getWorksheet('GENERAL')!;
      expect(general.getCell('D7').formula).toContain(
        "SUMIF('Servicios'!$C:$C,$C7,'Servicios'!$D:$D)",
      );
      expect(general.getCell('U7').formula).toBe('Q7+R7+S7+T7');
      expect(general.getCell('U7').result).toBe(230);
      expect(book.worksheets).toHaveLength(collision ? 4 : 3);
    },
  );

  function configurationFixture(
    existing: typeof services | null = null,
    entries: unknown[] = [],
  ) {
    const locations = {
      findFirst: jest.fn().mockResolvedValue(existing),
      findMany: jest.fn().mockResolvedValue([services]),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
      upsert: jest.fn(),
    };
    const transaction = {
      $executeRaw: jest.fn(),
      generalPayrollProject: locations,
      generalPayrollEntry: {
        findMany: jest.fn().mockResolvedValue(entries),
        createMany: jest.fn(),
      },
      generalPayrollWorker: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValue([worker]),
        deleteMany: jest.fn(),
        upsert: jest.fn(),
      },
    };
    const prisma = {
      week: { findUnique: jest.fn().mockResolvedValue(payroll.week) },
      generalPayroll: { upsert: jest.fn().mockResolvedValue(payroll) },
      project: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn() },
      worker: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ workerId: 7, dailyWages: [{ amount: 100 }] }]),
      },
      $transaction: jest.fn(async (fn) => fn(transaction)),
    };
    const service = new GeneralPayrollService(
      prisma as unknown as PrismaService,
    );
    jest
      .spyOn(service, 'findOne')
      .mockResolvedValue({} as Awaited<ReturnType<typeof service.findOne>>);
    return { service, locations, transaction, prisma };
  }
  const configuration = {
    projectIds: [],
    workers: [{ workerId: 7, group: GeneralPayrollWorkerGroupDto.laborer }],
    includeServices: true,
  };

  it('creates an independent location and worker matrix, never a Project', async () => {
    const { service, locations, transaction, prisma } = configurationFixture();
    await service.configure(9, configuration);
    expect(locations.create).toHaveBeenCalledWith({
      data: {
        generalPayrollId: 1,
        projectId: null,
        locationType: 'services',
        displayOrder: 0,
      },
    });
    expect(prisma.project.create).not.toHaveBeenCalled();
    expect(transaction.generalPayrollEntry.createMany).toHaveBeenCalledWith({
      data: [{ generalPayrollProjectId: 11, generalPayrollWorkerId: 15 }],
      skipDuplicates: true,
    });
  });
  it.each([true, undefined])(
    'keeps existing Services identity when configured with %s',
    async (includeServices) => {
      const { service, locations } = configurationFixture(services);
      await service.configure(9, { ...configuration, includeServices });
      expect(locations.create).not.toHaveBeenCalled();
      expect(locations.update).toHaveBeenCalledWith({
        where: { generalPayrollProjectId: 11 },
        data: { displayOrder: 0 },
      });
    },
  );
  it('requires confirmation and attendance/payment permissions to remove recorded Services', async () => {
    const { service, locations } = configurationFixture(
      services,
      services.entries,
    );
    const removal = { ...configuration, includeServices: false };
    await expect(
      service.configure(9, removal, ['payroll.attendance', 'payroll.payments']),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.configure(9, { ...removal, confirmRemoveServices: true }, []),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(locations.deleteMany).not.toHaveBeenCalled();
    await service.configure(9, { ...removal, confirmRemoveServices: true }, [
      'payroll.attendance',
      'payroll.payments',
    ]);
    expect(locations.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([{ locationType: 'services' }]),
        }),
      }),
    );
  });

  it.each([false, true])(
    'validates a saved day against other locations inside the transaction (duplicate: %s)',
    async (duplicate) => {
      const entries = [
        {
          ...services.entries[0],
          payrollWorker: { worker: worker.worker },
          payrollProject: services,
        },
        {
          ...services.entries[0],
          generalPayrollEntryId: 21,
          monday: 0,
          dominical: 0,
          payrollWorker: { worker: worker.worker },
          payrollProject: {
            locationType: 'project',
            project: { name: 'Obra' },
          },
        },
      ];
      const transaction = {
        $executeRaw: jest.fn(),
        generalPayrollWorker: { count: jest.fn().mockResolvedValue(0) },
        generalPayrollEntry: {
          findMany: jest.fn().mockResolvedValue(entries),
          update: jest.fn(),
        },
      };
      const prisma = {
        generalPayroll: { findUnique: jest.fn().mockResolvedValue(payroll) },
        $transaction: jest.fn(async (fn) => fn(transaction)),
      } as unknown as PrismaService;
      const service = new GeneralPayrollService(prisma);
      jest
        .spyOn(service, 'findOne')
        .mockResolvedValue({} as Awaited<ReturnType<typeof service.findOne>>);
      const result = service.save(9, {
        workers: [],
        entries: [
          { generalPayrollEntryId: 21, monday: duplicate ? 1 : 0, tuesday: 1 },
        ],
      });
      if (duplicate) {
        await expect(result).rejects.toThrow('Servicios');
        expect(transaction.generalPayrollEntry.update).not.toHaveBeenCalled();
      } else {
        await result;
        expect(transaction.generalPayrollEntry.update).toHaveBeenCalled();
      }
      expect(transaction.$executeRaw).toHaveBeenCalled();
    },
  );
});
