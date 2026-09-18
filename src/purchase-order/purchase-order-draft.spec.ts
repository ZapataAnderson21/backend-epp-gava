import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from 'src/generated/prisma';
import {
  endpointPermissions,
  satisfies,
} from 'src/permissions/endpoint-policy';
import { PurchaseOrderDraftService } from './purchase-order-draft.service';
import {
  DraftSlotDto,
  SavePurchaseOrderDraftDto,
} from './dto/purchase-order-draft.dto';

describe('Purchase order drafts', () => {
  const draft = {
    findUnique: jest.fn(),
    createMany: jest.fn(),
    updateMany: jest.fn(),
  };
  const project = { findFirst: jest.fn() };
  const order = { findFirst: jest.fn() };
  const prisma = {
    purchaseOrderDraft: draft,
    project,
    purchaseOrder: order,
    $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) =>
      callback({ purchaseOrderDraft: draft }),
    ),
  };
  const service = new PurchaseOrderDraftService(
    prisma as unknown as PrismaService,
  );
  beforeEach(() => {
    jest.clearAllMocks();
    project.findFirst.mockResolvedValue({ projectId: 2 });
    order.findFirst.mockResolvedValue({ purchaseOrderId: 7 });
    draft.findUnique.mockResolvedValue(null);
    draft.createMany.mockResolvedValue({ count: 1 });
    draft.updateMany.mockResolvedValue({ count: 1 });
  });

  it('reads only the authenticated user/project/slot and returns an empty revision', async () => {
    expect(await service.read(1, 2, 'new')).toEqual({
      version: 0,
      payload: null,
      updatedAt: null,
    });
    expect(draft.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_projectId_slot: { userId: 1, projectId: 2, slot: 'new' },
        },
      }),
    );
  });
  it('accepts incomplete data without creating a formal order', async () => {
    await service.save(1, 2, 'new', {
      expectedVersion: 0,
      payload: { code: 'A' },
    });
    expect(draft.createMany).toHaveBeenCalledWith({
      data: { userId: 1, projectId: 2, slot: 'new', payload: { code: 'A' } },
      skipDuplicates: true,
    });
  });
  it('rejects stale updates and racing initial inserts', async () => {
    draft.updateMany.mockResolvedValue({ count: 0 });
    draft.createMany.mockResolvedValue({ count: 0 });
    draft.findUnique.mockResolvedValue({
      payload: { code: 'remote' },
      version: 2,
    });
    await expect(
      service.save(1, 2, 'new', {
        expectedVersion: 1,
        payload: { code: 'local' },
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.save(1, 2, 'new', { expectedVersion: 0, payload: {} }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(draft.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 1, projectId: 2, slot: 'new', version: 1 },
      }),
    );
  });
  it('clears using a revisioned tombstone, not a delete that permits stale resurrection', async () => {
    await service.save(1, 2, '7', { expectedVersion: 3, payload: null });
    expect(draft.updateMany).toHaveBeenCalledWith({
      where: { userId: 1, projectId: 2, slot: '7', version: 3 },
      data: { payload: Prisma.DbNull, version: { increment: 1 } },
    });
  });
  it('rejects nonexistent projects and orders from another project', async () => {
    project.findFirst.mockResolvedValue(null);
    await expect(service.read(1, 2, 'new')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    project.findFirst.mockResolvedValue({ projectId: 2 });
    order.findFirst.mockResolvedValue(null);
    await expect(
      service.save(1, 2, '7', { expectedVersion: 0, payload: {} }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(draft.createMany).not.toHaveBeenCalled();
  });
  it('bounds payload bytes', async () => {
    await expect(
      service.save(1, 2, 'new', {
        expectedVersion: 0,
        payload: { code: 'á'.repeat(40000) },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('requires both order management and financial access for reading and writing', () => {
    for (const method of ['GET', 'PUT']) {
      const required = endpointPermissions(
        'PurchaseOrderDraftController',
        'save',
        method,
      );
      expect(satisfies(['orders.view', 'orders.manage'], required)).toBe(false);
      expect(
        satisfies(['orders.view', 'orders.manage', 'finance.view'], required),
      ).toBe(true);
    }
  });
  it('validates routes and rejects undefined payload, forged owner, and negative version', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    await expect(
      pipe.transform(
        { projectId: '2', slot: 'new' },
        { type: 'param', metatype: DraftSlotDto },
      ),
    ).resolves.toBeInstanceOf(DraftSlotDto);
    for (const value of [
      { expectedVersion: 0 },
      { expectedVersion: -1, payload: {} },
      { expectedVersion: 0, payload: {}, userId: 9 },
      { expectedVersion: 0, payload: [] },
    ]) {
      await expect(
        pipe.transform(value, {
          type: 'body',
          metatype: SavePurchaseOrderDraftDto,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
    await expect(
      pipe.transform(
        { expectedVersion: 1, payload: null },
        { type: 'body', metatype: SavePurchaseOrderDraftDto },
      ),
    ).resolves.toBeInstanceOf(SavePurchaseOrderDraftDto);
  });
});
