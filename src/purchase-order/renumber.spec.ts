import {
  buildRenumberPlan,
  numberingFingerprint,
  NumberedOrder,
} from './renumber-plan';
import { RenumberService } from './renumber.service';
import { PrismaService } from '../prisma/prisma.service';
import { endpointPermissions, satisfies } from '../permissions/endpoint-policy';
import {
  initialPermissions,
  normalizePermissions,
} from '../permissions/catalog';

const row = (id: number, n: number): NumberedOrder => ({
  purchaseOrderId: id,
  code: `No ${n}-2026/PROYECTO-${id}/PROV`,
  updatedAt: new Date('2026-09-01'),
  status: 'authorized',
  project: { name: `Proyecto ${id}` },
  supplier: { name: 'Proveedor' },
});
describe('Corrección de numeración', () => {
  it('ordena la selección y conserva sufijos, IDs y año', () => {
    const plan = buildRenumberPlan(
      [row(1, 242), row(2, 244), row(3, 245)],
      [3, 2],
      2026,
      243,
    );
    expect(plan.changes.map((c) => [c.purchaseOrderId, c.after])).toEqual([
      [2, 'No 243-2026/PROYECTO-2/PROV'],
      [3, 'No 244-2026/PROYECTO-3/PROV'],
    ]);
    expect(plan.nextNumber).toBe(245);
  });
  it('el siguiente número considera también las OC no seleccionadas', () => {
    expect(
      buildRenumberPlan([row(1, 244), row(2, 250)], [1], 2026, 243).nextNumber,
    ).toBe(251);
  });
  it('rechaza destino ocupado, repetidos, otro año, faltantes y operaciones vacías', () => {
    expect(() =>
      buildRenumberPlan([row(1, 243), row(2, 244)], [2], 2026, 243),
    ).toThrow('ocupado');
    expect(() =>
      buildRenumberPlan([row(1, 244), row(2, 244)], [1], 2026, 243),
    ).toThrow('repetidos');
    expect(() => buildRenumberPlan([row(1, 244)], [1], 2025, 243)).toThrow();
    expect(() => buildRenumberPlan([row(1, 244)], [2], 2026, 243)).toThrow();
    expect(() => buildRenumberPlan([row(1, 244)], [1], 2026, 244)).toThrow();
  });
  it('exige permisos independientes, sin finance.view ni concesión inicial', () => {
    for (const role of [
      'GERENTE',
      'ADMINISTRADORA',
      'LOGISTICA',
      'ADMINISTRADOR',
    ])
      expect(initialPermissions(role)).not.toContain('orders.renumber');
    const granted = normalizePermissions(['orders.renumber']);
    expect(granted).toEqual(['orders.renumber', 'orders.view']);
    for (const handler of ['candidates', 'preview', 'apply']) {
      expect(
        satisfies(
          granted,
          endpointPermissions('RenumberController', handler, 'POST'),
        ),
      ).toBe(true);
      expect(
        satisfies(
          ['orders.view', 'orders.manage', 'orders.delete', 'orders.authorize'],
          endpointPermissions('RenumberController', handler, 'POST'),
        ),
      ).toBe(false);
    }
    expect(
      satisfies(
        granted,
        endpointPermissions('RenumberController', 'history', 'GET'),
      ),
    ).toBe(false);
  });
});

function fixture() {
  let orders = [row(1, 244), row(2, 245)];
  const plan = buildRenumberPlan(orders, [1, 2], 2026, 243);
  let operation = {
    id: 'attempt',
    userId: 7,
    year: 2026,
    actorName: 'Prueba',
    plan,
    fingerprint: numberingFingerprint(orders),
    createdAt: new Date(),
    appliedAt: null as Date | null,
    reason: null as string | null,
  };
  let fail = false;
  const update = jest.fn(
    async ({
      where,
      data,
    }: {
      where: { purchaseOrderId: number };
      data: { code: string };
    }) => {
      if (fail && data.code.startsWith('No'))
        throw new Error('simulated database error');
      if (
        orders.some(
          (r) =>
            r.purchaseOrderId !== where.purchaseOrderId && r.code === data.code,
        )
      )
        throw new Error('unique code');
      orders = orders.map((r) =>
        r.purchaseOrderId === where.purchaseOrderId ? { ...r, ...data } : r,
      );
    },
  );
  const tx = {
    $executeRaw: jest.fn(),
    $executeRawUnsafe: jest.fn(),
    purchaseOrder: { findMany: jest.fn(async () => orders), update },
    purchaseOrderRenumber: {
      findUnique: jest.fn(async () => operation),
      update: jest.fn(async ({ data }: { data: Partial<typeof operation> }) => {
        operation = { ...operation, ...data };
        return operation;
      }),
    },
  };
  let queue = Promise.resolve();
  const prisma = {
    $transaction: async (run: (client: typeof tx) => Promise<unknown>) => {
      const previous = queue;
      let release!: () => void;
      queue = new Promise<void>((r) => {
        release = r;
      });
      await previous;
      const oldOrders = structuredClone(orders),
        oldOperation = structuredClone(operation);
      try {
        return await run(tx);
      } catch (e) {
        orders = oldOrders;
        operation = oldOperation;
        throw e;
      } finally {
        release();
      }
    },
  } as unknown as PrismaService;
  return {
    service: new RenumberService(prisma),
    tx,
    orders: () => orders,
    operation: () => operation,
    setFail: (v: boolean) => {
      fail = v;
    },
    edit: () => {
      orders[0].code = 'No 244-2026/EDITADO/PROV';
    },
    expire: () => {
      operation.createdAt = new Date(0);
    },
  };
}
describe('Aplicación transaccional con doble de base de datos', () => {
  it('desplaza grupos sin colisiones y registra el motivo; reintentar no repite', async () => {
    const f = fixture();
    await Promise.all([
      f.service.apply('attempt', 'Se eliminó una OC', 7),
      f.service.apply('attempt', 'Se eliminó una OC', 7),
    ]);
    expect(f.orders().map((o) => o.code)).toEqual([
      'No 243-2026/PROYECTO-1/PROV',
      'No 244-2026/PROYECTO-2/PROV',
    ]);
    expect(f.tx.purchaseOrder.update).toHaveBeenCalledTimes(4);
    expect(f.operation().reason).toBe('Se eliminó una OC');
    expect(f.operation().appliedAt).toBeInstanceOf(Date);
  });
  it('revierte todas las filas y el historial si falla una actualización', async () => {
    const f = fixture();
    f.setFail(true);
    await expect(f.service.apply('attempt', 'Corrección', 7)).rejects.toThrow(
      'simulated',
    );
    expect(f.orders().map((o) => o.code)).toEqual([
      'No 244-2026/PROYECTO-1/PROV',
      'No 245-2026/PROYECTO-2/PROV',
    ]);
    expect(f.operation().appliedAt).toBeNull();
    f.setFail(false);
    await expect(
      f.service.apply('attempt', 'Corrección', 7),
    ).resolves.toBeDefined();
  });
  it('bloquea vista previa desactualizada o vencida y usuario diferente', async () => {
    const f = fixture();
    await expect(f.service.apply('attempt', 'Corrección', 8)).rejects.toThrow(
      'no encontrada',
    );
    f.edit();
    await expect(f.service.apply('attempt', 'Corrección', 7)).rejects.toThrow(
      'cambiaron',
    );
    const expired = fixture();
    expired.expire();
    await expect(
      expired.service.apply('attempt', 'Corrección', 7),
    ).rejects.toThrow('venció');
    expect(f.tx.purchaseOrder.update).not.toHaveBeenCalled();
  });
});
