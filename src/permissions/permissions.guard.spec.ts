import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { PermissionsService } from './permissions.service';
import { PrismaService } from '../prisma/prisma.service';

function fixture(
  granted: string[],
  controller: string,
  handler: string,
  body: object = {},
  method = 'PUT',
) {
  const request = { user: { userId: 1 }, method, body, params: { id: '2' } };
  const access = { forUser: jest.fn().mockResolvedValue(granted) };
  const prisma = {
    purchaseOrder: {
      findUnique: jest.fn().mockResolvedValue({ status: 'pending' }),
    },
    userType: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ permissions: ['roles.manage'] }),
    },
  };
  const guard = new PermissionsGuard(
    { getAllAndOverride: () => false } as unknown as Reflector,
    access as unknown as PermissionsService,
    prisma as unknown as PrismaService,
  );
  const context = {
    getClass: () => ({ name: controller }),
    getHandler: () => ({ name: handler }),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { run: () => guard.canActivate(context), access };
}

describe('Sensitive operation guard', () => {
  it('lets attendance editors save days but not payments or payroll configuration', async () => {
    const granted = ['payroll.view', 'payroll.attendance'];
    await expect(
      fixture(granted, 'GeneralPayrollController', 'save', {
        workers: [],
        entries: [{ monday: 1 }],
      }).run(),
    ).resolves.toBe(true);
    await expect(
      fixture(granted, 'GeneralPayrollController', 'save', {
        workers: [],
        entries: [{ overtimeAmount: 10 }],
      }).run(),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      fixture(granted, 'GeneralPayrollController', 'configure', {}).run(),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('lets payment editors save amounts without day fields', async () => {
    const granted = ['payroll.view', 'payroll.payments', 'finance.view'];
    await expect(
      fixture(granted, 'GeneralPayrollController', 'save', {
        workers: [],
        entries: [{ overtimeAmount: 10 }],
      }).run(),
    ).resolves.toBe(true);
    await expect(
      fixture(granted, 'GeneralPayrollController', 'save', {
        workers: [],
        entries: [{ monday: 1 }],
      }).run(),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('authorizes a status-only order change without granting edit access', async () => {
    const granted = ['orders.view', 'orders.authorize'];
    await expect(
      fixture(
        granted,
        'PurchaseOrderController',
        'update',
        { status: 'authorized' },
        'PATCH',
      ).run(),
    ).resolves.toBe(true);
    await expect(
      fixture(
        granted,
        'PurchaseOrderController',
        'update',
        { status: 'authorized', purchaseAmount: 10 },
        'PATCH',
      ).run(),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      fixture(
        ['orders.view', 'orders.manage', 'finance.view'],
        'PurchaseOrderController',
        'update',
        { status: 'authorized' },
        'PATCH',
      ).run(),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('prevents descriptions from bypassing request transition permissions', async () => {
    await expect(
      fixture(
        ['requests.view', 'requests.review'],
        'RequestResponseController',
        'update',
        { logisticsDescription: 'test' },
        'PATCH',
      ).run(),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('prevents assigning privileges the actor does not possess', async () => {
    await expect(
      fixture(
        ['users.view', 'users.assignRole'],
        'PermissionsController',
        'assign',
        { userTypeId: 2 },
      ).run(),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('checks live permissions on each request', async () => {
    const check = fixture(
      ['workers.view', 'workers.manage'],
      'WorkerController',
      'update',
    );
    await expect(check.run()).resolves.toBe(true);
    check.access.forUser.mockResolvedValue(['workers.view']);
    await expect(check.run()).rejects.toBeInstanceOf(ForbiddenException);
  });
});

it('enforces renumber permission on the API without requiring finance access', async () => {
  await expect(fixture(['orders.view', 'orders.renumber'], 'RenumberController', 'apply', {reason:'Corrección'}, 'POST').run()).resolves.toBe(true);
  await expect(fixture(['orders.view', 'orders.manage', 'finance.view'], 'RenumberController', 'apply', {}, 'POST').run()).rejects.toBeInstanceOf(ForbiddenException);
  await expect(fixture(['orders.view', 'orders.renumberHistory'], 'RenumberController', 'history', {}, 'GET').run()).resolves.toBe(true);
});
