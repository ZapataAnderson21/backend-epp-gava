import { BadRequestException, ConflictException } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { PrismaService } from '../prisma/prisma.service';

function fixture() {
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    userType: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest
        .fn()
        .mockImplementation(({ data }) => ({ userTypeId: 3, ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest
        .fn()
        .mockResolvedValue({ userTypeId: 2, permissions: ['workers.view'] }),
    },
    user: { findFirst: jest.fn().mockResolvedValue({ userId: 1 }) },
    userUserType: {
      count: jest.fn().mockResolvedValue(1),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue({}),
    },
  };
  const prisma = {
    $transaction: (run: (client: typeof tx) => unknown) => run(tx),
  };
  return {
    tx,
    service: new PermissionsService(prisma as unknown as PrismaService),
  };
}

describe('Role persistence safeguards', () => {
  it('normalizes a new role and persists permission dependencies', async () => {
    const { service, tx } = fixture();
    await service.save(undefined, {
      name: ' operaciones ',
      permissions: ['payroll.payments'],
    });
    expect(tx.userType.create).toHaveBeenCalledWith({
      data: {
        name: 'OPERACIONES',
        description: '',
        permissions: ['finance.view', 'payroll.payments', 'payroll.view'],
      },
    });
  });
  it('rejects stale versions instead of overwriting another editor', async () => {
    const { service, tx } = fixture();
    tx.userType.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.save(2, { name: 'Obra', permissions: [], version: 1 }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.userType.updateMany.mock.calls[0][0].where).toEqual({
      userTypeId: 2,
      version: 1,
    });
  });
  it('rejects revoking the last permission administrator', async () => {
    const { service, tx } = fixture();
    tx.userUserType.count.mockResolvedValue(0);
    await expect(
      service.save(2, { name: 'Obra', permissions: [], version: 1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rejects reassigning the last administrator to an unprivileged role', async () => {
    const { service, tx } = fixture();
    tx.userUserType.count.mockResolvedValue(0);
    await expect(service.assign(1, 2)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
  it('does not accept unknown permission keys', async () => {
    const { service, tx } = fixture();
    await expect(
      service.save(undefined, {
        name: 'Obra',
        permissions: ['unknown.manage'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.userType.create).not.toHaveBeenCalled();
  });
});
