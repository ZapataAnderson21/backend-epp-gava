import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Currency } from 'src/generated/prisma';
import { PrismaService } from 'src/prisma/prisma.service';
import { DashboardService } from './dashboard.service';
import { DashboardQueryDto } from './dashboard-query.dto';
import {
  dashboardPeriod,
  dashboardPermissions,
  limaDate,
  payrollAmounts,
} from './dashboard-calculations';

const date = (value: string) => new Date(value);
const containing = (value: Record<string, unknown>): unknown =>
  expect.objectContaining(value);
const entry = (overrides = {}) => ({
  generalPayrollWorkerId: 1,
  monday: 1,
  tuesday: 1,
  wednesday: 0,
  thursday: 0,
  friday: 0,
  saturday: 0,
  dominical: 1,
  overtimeAmount: 10,
  afpDiscount: 35,
  advanceDiscount: 15,
  ...overrides,
});

function fixture(roles = ['GERENTE']) {
  const findMany = () => jest.fn().mockResolvedValue([]);
  const prisma = {
    userUserType: {
      findMany: jest
        .fn()
        .mockResolvedValue(roles.map((name) => ({ userType: { name } }))),
    },
    project: {
      findMany: jest.fn().mockResolvedValue([
        {
          projectId: 1,
          name: 'Proyecto uno',
          code: 'P1',
          status: 'active',
          endDate: date('2026-07-30'),
        },
        {
          projectId: 2,
          name: 'Proyecto dos',
          code: 'P2',
          status: 'completed',
          endDate: null,
        },
      ]),
    },
    purchaseOrder: { findMany: findMany() },
    serviceSale: { findMany: findMany() },
    pettyCash: { findMany: findMany() },
    generalPayroll: { findMany: findMany() },
    task: { findMany: findMany() },
    request: { findMany: findMany() },
    emergency: { findMany: findMany() },
    expiringDocument: { findMany: findMany() },
    element: { findMany: findMany() },
  };
  return {
    prisma,
    service: new DashboardService(prisma as unknown as PrismaService),
  };
}

function payrollFixture() {
  return {
    week: {
      weekId: 1,
      startDate: date('2026-08-31'),
      endDate: date('2026-09-06'),
    },
    workers: [
      {
        generalPayrollWorkerId: 1,
        workerId: 50,
        group: 'laborer',
        dailyWage: 60,
        additionalAmount: 10,
        liquidationAmount: 20,
        sundayDinnerAmount: 30,
      },
    ],
    projects: [
      { projectId: 1, entries: [entry()] },
      {
        projectId: 2,
        entries: [
          entry({
            monday: 0,
            tuesday: 0,
            wednesday: 1,
            thursday: 1,
            friday: 1,
            saturday: 1,
            dominical: 0,
            overtimeAmount: 0,
            afpDiscount: 0,
            advanceDiscount: 0,
          }),
        ],
      },
    ],
  };
}

describe('General dashboard', () => {
  it('keeps calendar months and Lima timestamps separate across years', () => {
    expect(dashboardPeriod(1, 2027)).toEqual({
      keys: ['2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01'],
      from: date('2026-08-01T05:00:00Z'),
      to: date('2027-02-01T05:00:00Z'),
      startDate: '2027-01-01',
      endDate: '2027-02-01',
    });
    expect(limaDate(date('2026-09-01T04:59:59Z'))).toBe('2026-08-31');
    expect(limaDate(date('2026-09-01T05:00:00Z'))).toBe('2026-09-01');
  });

  it('counts dominical as a payable day and applies only base deductions', () => {
    expect(payrollAmounts(entry(), 60)).toEqual({
      attendances: 2,
      dominical: 1,
      base: 140,
    });
  });

  it.each([
    [[], false, false, false],
    [['GERENTE'], true, true, true],
    [['ADMINISTRADORA'], true, true, true],
    [['ADMINISTRADOR'], false, true, false],
    [['LOGISTICA'], false, true, true],
    [['PREVENCIONISTA DE RIESGOS'], false, false, true],
    [['ADMINISTRADOR', 'LOGISTICA'], true, true, true],
  ])(
    'uses source permissions for roles %j',
    (roles, finance, payroll, documents) => {
      expect(dashboardPermissions(roles)).toMatchObject({
        finance,
        payroll,
        documents,
      });
    },
  );

  it('validates filters and coerces numeric query strings', async () => {
    const valid = plainToInstance(DashboardQueryDto, {
      month: '9',
      year: '2026',
      projectId: '1',
      currency: 'PEN',
    });
    expect(await validate(valid)).toHaveLength(0);
    expect(valid.projectId).toBe(1);
    const invalid = plainToInstance(DashboardQueryDto, {
      month: '13',
      year: 'x',
      projectId: '-2',
      currency: 'GBP',
    });
    expect(await validate(invalid)).toHaveLength(4);
  });

  it('aggregates income, IGV, payroll and global additions without double counting', async () => {
    const { prisma, service } = fixture();
    prisma.purchaseOrder.findMany.mockResolvedValueOnce([
      {
        projectId: 1,
        createdAt: date('2026-09-02T12:00:00Z'),
        purchaseAmount: 300,
        saleAmount: 1000,
        purchaseOrderType: 'materials',
        status: 'pending',
      },
    ]);
    prisma.serviceSale.findMany.mockResolvedValue([
      { projectId: 1, createdAt: date('2026-09-02T12:00:00Z'), amount: 100 },
    ]);
    prisma.pettyCash.findMany.mockResolvedValue([
      {
        projectId: 1,
        expenseDate: date('2026-09-02T12:00:00Z'),
        amount: 100,
        includesIgv: false,
      },
    ]);
    prisma.generalPayroll.findMany.mockResolvedValue([payrollFixture()]);
    const { data } = await service.findGeneral({ month: 9, year: 2026 }, 7);
    expect(data.finances).toMatchObject({
      income: 1100,
      materials: 300,
      pettyCash: 118,
      payroll: 380,
      adjustments: 60,
      expenses: 858,
      result: 242,
      pendingPurchases: 300,
    });
    expect(data.payroll?.total).toBe(440);
    expect(data.payroll?.weeks[0].groups[0]).toMatchObject({
      workerCount: 1,
      attendances: 6,
      dominical: 1,
      total: 440,
    });
    expect(data.projects[0].finances).toMatchObject({
      expenses: 558,
      result: 542,
      adjustments: 0,
    });
    expect(prisma.purchaseOrder.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: containing({
          status: { not: 'cancelled' },
          supplier: { currency: 'PEN' },
        }),
      }),
    );
  });

  it('shows a cross-month week in both months but books it only in its ending month', async () => {
    const { prisma, service } = fixture();
    prisma.generalPayroll.findMany.mockResolvedValue([payrollFixture()]);
    const august = (await service.findGeneral({ month: 8, year: 2026 }, 7))
      .data;
    expect(august.payroll?.weeks).toHaveLength(1);
    expect(august.payroll?.weeks[0].includedInMonth).toBe(false);
    expect(august.payroll?.total).toBe(0);
    expect(august.finances?.expenses).toBe(0);
    const september = (await service.findGeneral({ month: 9, year: 2026 }, 7))
      .data;
    expect(september.payroll?.total).toBe(440);
    expect(september.finances?.expenses).toBe(440);
  });

  it('excludes global additions from a project and filters every project-scoped source', async () => {
    const { prisma, service } = fixture();
    const payroll = payrollFixture();
    payroll.projects = [payroll.projects[0]];
    prisma.generalPayroll.findMany.mockResolvedValue([payroll]);
    const { data } = await service.findGeneral(
      { month: 9, year: 2026, projectId: 1 },
      7,
    );
    expect(data.payroll).toMatchObject({ total: 140, projectOnly: true });
    expect(data.finances).toMatchObject({ payroll: 140, adjustments: 0 });
    expect(data.projects).toHaveLength(1);
    for (const model of [
      prisma.task,
      prisma.request,
      prisma.emergency,
      prisma.pettyCash,
      prisma.serviceSale,
    ]) {
      expect(model.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: containing({ projectId: { in: [1] } }),
        }),
      );
    }
    expect(prisma.generalPayroll.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: containing({
          projects: containing({
            where: { projectId: { in: [1] } },
          }),
        }),
      }),
    );
  });

  it('does not add PEN payroll or petty cash to another currency', async () => {
    const { prisma, service } = fixture();
    prisma.generalPayroll.findMany.mockResolvedValue([payrollFixture()]);
    const { data } = await service.findGeneral(
      { month: 9, year: 2026, currency: Currency.USD },
      7,
    );
    expect(data.finances?.expenses).toBe(0);
    expect(data.payroll).toMatchObject({ total: 440, currency: 'PEN' });
    expect(prisma.pettyCash.findMany).not.toHaveBeenCalled();
    expect(prisma.purchaseOrder.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: containing({ supplier: { currency: 'USD' } }),
      }),
    );
  });

  it('never queries or serializes restricted amounts/documents for an operational user', async () => {
    const { prisma, service } = fixture(['OBRERO']);
    const { data } = await service.findGeneral({ month: 9, year: 2026 }, 7);
    expect(data.finances).toBeNull();
    expect(data.payroll).toBeNull();
    expect(data.projects.every((project) => project.finances === null)).toBe(
      true,
    );
    for (const model of [
      prisma.purchaseOrder,
      prisma.serviceSale,
      prisma.pettyCash,
      prisma.generalPayroll,
      prisma.expiringDocument,
    ]) {
      expect(model.findMany).not.toHaveBeenCalled();
    }
  });

  it('does not grant LOGISTICA access to separately registered income', async () => {
    const { prisma, service } = fixture(['LOGISTICA']);
    const { data } = await service.findGeneral({ month: 9, year: 2026 }, 7);
    expect(data.finances).toBeNull();
    expect(data.payroll).not.toBeNull();
    expect(prisma.serviceSale.findMany).not.toHaveBeenCalled();
    expect(prisma.purchaseOrder.findMany).toHaveBeenCalledTimes(1);
  });

  it('keeps current alerts independent of the financial period and labels global alerts', async () => {
    const { prisma, service } = fixture();
    prisma.expiringDocument.findMany.mockResolvedValue([
      { expirationDate: date('2001-01-01') },
    ]);
    prisma.element.findMany.mockResolvedValue([
      { stockMinimum: 5, officeInventoryEntries: [{ currentStock: 2 }] },
    ]);
    const { data } = await service.findGeneral({ month: 1, year: 2020 }, 7);
    expect(data.alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'expired', count: 1, scope: 'global' }),
        expect.objectContaining({ key: 'stock', count: 1, scope: 'global' }),
      ]),
    );
    const documentArgs = (
      prisma.expiringDocument.findMany.mock.calls as unknown[][]
    )[0][0] as {
      where: { expirationDate: { gte?: Date; lte: Date } };
    };
    expect(documentArgs.where.expirationDate.gte).toBeUndefined();
    expect(documentArgs.where.expirationDate.lte.getFullYear()).toBeGreaterThan(
      2020,
    );
  });

  it('rejects unknown/deleted project filters and returns zero for empty data', async () => {
    const { prisma, service } = fixture();
    await expect(service.findGeneral({ projectId: 999 }, 7)).rejects.toThrow(
      'El proyecto seleccionado no existe',
    );
    prisma.project.findMany.mockResolvedValue([]);
    const { data } = await service.findGeneral({}, 7);
    expect(data.activeProjects).toBe(0);
    expect(data.finances).toMatchObject({ income: 0, expenses: 0, result: 0 });
    expect(data.finances?.trend).toHaveLength(6);
    expect(data.projects).toEqual([]);
  });
});
