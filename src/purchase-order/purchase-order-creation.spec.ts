import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { PurchaseOrderService } from './purchase-order.service';
import { CreateCompletePurchaseOrderDto } from './dto/create-complete-purchase-order.dto';
import { PaymentMethod, PurchaseOrderType } from './enum';

const input = (): CreateCompletePurchaseOrderDto => ({
  creationKey: randomUUID(),
  code: 'OBRA',
  deliveryLocation: 'Almacén',
  destination: 'Obra',
  paymentConditions: 'Contado',
  paymentMethod: PaymentMethod.Transfer,
  saleAmount: 20,
  purchaseAmount: 10,
  carePerson: 'Persona',
  dniCarePerson: '12345678',
  projectId: 1,
  supplierId: 1,
  purchaseOrderType: PurchaseOrderType.Materials,
  items: [
    {
      resourceId: 1,
      quantity: 2,
      unitPurchasePrice: 5,
      unitSalesPrice: 10,
      orderNumber: 1,
    },
  ],
});

// A transactional double exercises orchestration and rollback paths without touching production.
function setup() {
  let orders: Array<Record<string, any>> = [];
  let receipts: Array<Record<string, any>> = [];
  let items: Array<Record<string, any>> = [];
  let nextId = 0;
  let failItems = false;
  let queue = Promise.resolve();
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    project: { findFirst: jest.fn().mockResolvedValue({ projectId: 1 }) },
    supplier: {
      findUnique: jest.fn().mockResolvedValue({ abbreviation: 'ABC' }),
    },
    purchaseOrder: {
      findMany: jest.fn(async () => orders),
      findUnique: jest.fn(
        async ({ where }) =>
          orders.find((o) => o.purchaseOrderId === where.purchaseOrderId) ??
          null,
      ),
      create: jest.fn(async ({ data }) => {
        const row = {
          ...data,
          purchaseOrderId: ++nextId,
          project: { name: 'Obra' },
          resources: [],
        };
        orders.push(row);
        return row;
      }),
    },
    resourcePurchaseOrder: {
      createMany: jest.fn(async ({ data }) => {
        if (failItems) throw new Error('Ítem inválido');
        items.push(...data);
        return { count: data.length };
      }),
    },
    purchaseOrderCreation: {
      findUnique: jest.fn(async ({ where }) =>
        receipts.find(
          (r) =>
            r.userId === where.userId_key.userId &&
            r.key === where.userId_key.key,
        ),
      ),
      create: jest.fn(async ({ data }) => {
        receipts.push(data);
        return data;
      }),
    },
  };
  const prisma = {
    $transaction: jest.fn((run) => {
      const execution = queue.then(async () => {
        const snapshot = structuredClone({ orders, receipts, items });
        try {
          return await run(tx);
        } catch (error) {
          orders = snapshot.orders;
          receipts = snapshot.receipts;
          items = snapshot.items;
          throw error;
        }
      });
      queue = execution.then(
        () => undefined,
        () => undefined,
      );
      return execution;
    }),
  };
  const notifications = {
    notifyPurchaseOrderPending: jest.fn().mockResolvedValue(undefined),
  };
  const service = new PurchaseOrderService(
    prisma as unknown as PrismaService,
    notifications as unknown as NotificationService,
  );
  return {
    service,
    tx,
    notifications,
    state: () => ({ orders, receipts, items }),
    fail: (value: boolean) => {
      failItems = value;
    },
    deleteOrders: () => {
      orders = [];
    },
  };
}

describe('Atomic purchase order creation', () => {
  it('rolls back the header and receipt when an item fails, then retries the same key', async () => {
    const f = setup();
    const dto = input();
    f.fail(true);
    await expect(f.service.create(dto, 1)).rejects.toThrow('Ítem inválido');
    expect(f.state()).toEqual({ orders: [], receipts: [], items: [] });
    f.fail(false);
    const saved = await f.service.create(dto, 1);
    expect(saved.data.code).toMatch(/^No 001-/);
    expect(f.state().items).toHaveLength(1);
  });
  it('replays a committed response and concurrent requests without creating another order', async () => {
    const f = setup();
    const dto = input();
    const [a, b] = await Promise.all([
      f.service.create(dto, 1),
      f.service.create(dto, 1),
    ]);
    expect(a.data.purchaseOrderId).toBe(b.data.purchaseOrderId);
    expect(f.state().orders).toHaveLength(1);
    expect(f.notifications.notifyPurchaseOrderPending).toHaveBeenCalledTimes(1);
    expect(f.tx.$executeRaw).toHaveBeenCalledTimes(2);
  });
  it('assigns different numbers to different concurrent submissions', async () => {
    const f = setup();
    const [a, b] = await Promise.all([
      f.service.create(input(), 1),
      f.service.create(input(), 1),
    ]);
    expect(a.data.code).toMatch(/^No 001-/);
    expect(b.data.code).toMatch(/^No 002-/);
  });
  it('reports success despite a notification failure', async () => {
    const f = setup();
    f.notifications.notifyPurchaseOrderPending.mockRejectedValue(
      new Error('offline'),
    );
    expect((await f.service.create(input(), 1)).statusCode).toBe(201);
    expect(f.state().orders).toHaveLength(1);
  });
  it('rejects reusing a key with changed data and does not recreate a deleted order', async () => {
    const f = setup();
    const dto = input();
    await f.service.create(dto, 1);
    await expect(
      f.service.create({ ...dto, destination: 'Otra' }, 1),
    ).rejects.toThrow('Revísela');
    f.deleteOrders();
    await expect(f.service.create(dto, 1)).rejects.toThrow('eliminada');
    expect(f.state().orders).toHaveLength(0);
  });
  it('rejects duplicate resources before starting the transaction', async () => {
    const f = setup();
    const dto = input();
    dto.items.push({ ...dto.items[0] });
    await expect(f.service.create(dto, 1)).rejects.toThrow('no repita');
    expect(f.tx.$executeRaw).not.toHaveBeenCalled();
  });
  it('validates nested items, duplicate resources and mandatory retry key', () => {
    expect(
      validateSync(plainToInstance(CreateCompletePurchaseOrderDto, input())),
    ).toEqual([]);
    for (const change of [
      { creationKey: undefined },
      { items: [] },
      { items: [{ ...input().items[0], quantity: -1 }] },
      { items: [input().items[0], input().items[0]] },
    ]) {
      expect(
        validateSync(
          plainToInstance(CreateCompletePurchaseOrderDto, {
            ...input(),
            ...change,
          }),
        ).length,
      ).toBeGreaterThan(0);
    }
  });
  it('duplicates atomically and replays a copy after the response is lost', async () => {
    const f = setup();
    const original = await f.service.create(input(), 1);
    f.state().orders[0].resources = [
      {
        ...input().items[0],
        resourcePurchaseOrderId: 1,
        purchaseOrderId: original.data.purchaseOrderId,
      },
    ];
    const key = randomUUID();
    f.fail(true);
    await expect(
      f.service.duplicate(original.data.purchaseOrderId, 2, key, 1),
    ).rejects.toThrow('Ítem inválido');
    expect(f.state().orders).toHaveLength(1);
    f.fail(false);
    const copy = await f.service.duplicate(
      original.data.purchaseOrderId,
      2,
      key,
      1,
    );
    const replay = await f.service.duplicate(
      original.data.purchaseOrderId,
      2,
      key,
      1,
    );
    expect(copy.data.purchaseOrderId).toBe(replay.data.purchaseOrderId);
    expect(f.state().orders).toHaveLength(2);
  });
});
