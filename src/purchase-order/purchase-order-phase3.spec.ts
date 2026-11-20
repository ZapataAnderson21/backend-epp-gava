/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Jest asymmetric matchers are intentionally untyped. */
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { endpointPermissions } from 'src/permissions/endpoint-policy';
import { ListGlobalPurchaseOrdersQueryDto } from './dto/list-global-purchase-orders-query.dto';
import { PurchaseOrderService } from './purchase-order.service';

const createdAt = new Date('2026-11-17T12:00:00.000Z');
const baseOrder = {
  purchaseOrderId: 7,
  code: 'OC-2026-007',
  projectId: 10,
  supplierId: 5,
  purchaseOrderType: 'materials',
  status: 'pending',
  createdAt,
  project: { projectId: 10, name: 'Obra A', deletedAt: null },
  supplier: { supplierId: 5, name: 'Proveedor B', currency: 'PEN' },
};

function buildService() {
  const purchaseOrder = {
    findMany: jest.fn().mockResolvedValue([baseOrder]),
    count: jest.fn().mockResolvedValue(1),
  };
  const prisma = { purchaseOrder };
  const notifications = {};
  return {
    service: new PurchaseOrderService(prisma as never, notifications as never),
    purchaseOrder,
  };
}

function validQuery(overrides: Record<string, unknown> = {}) {
  return plainToInstance(ListGlobalPurchaseOrdersQueryDto, {
    page: 1,
    pageSize: 10,
    ...overrides,
  });
}

describe('purchase order Phase 3 global listing', () => {
  describe('query validation', () => {
    it.each(['materials', 'services'])(
      'accepts purchase order type %s',
      async (purchaseOrderType) => {
        await expect(
          validate(validQuery({ purchaseOrderType })),
        ).resolves.toHaveLength(0);
      },
    );

    it.each(['pending', 'authorized', 'delivered', 'cancelled'])(
      'accepts status %s',
      async (status) => {
        await expect(validate(validQuery({ status }))).resolves.toHaveLength(0);
      },
    );

    it.each([
      ['supplierId', 0],
      ['supplierId', 'abc'],
      ['projectId', -1],
      ['projectId', 1.2],
    ])('rejects invalid %s=%s', async (property, value) => {
      const errors = await validate(validQuery({ [property]: value }));
      expect(errors.some((error) => error.property === property)).toBe(true);
    });

    it('rejects an invalid purchase order type', async () => {
      const errors = await validate(
        validQuery({ purchaseOrderType: 'consulting' }),
      );
      expect(
        errors.some((error) => error.property === 'purchaseOrderType'),
      ).toBe(true);
    });

    it('rejects an invalid status', async () => {
      const errors = await validate(validQuery({ status: 'approved' }));
      expect(errors.some((error) => error.property === 'status')).toBe(true);
    });
  });

  describe('service query', () => {
    it('lists globally without filters and returns pagination metadata', async () => {
      const { service } = buildService();
      const result = await service.findPaginated(validQuery());

      expect(result.data.items).toHaveLength(1);
      expect(result.data.pagination).toEqual(
        expect.objectContaining({
          currentPage: 1,
          pageSize: 10,
          totalItems: 1,
        }),
      );
    });

    it('searches code, supplier and project through one OR expression', async () => {
      const { service, purchaseOrder } = buildService();
      await service.findPaginated(validQuery({ search: 'Obra A' }));

      expect(purchaseOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { code: { contains: 'Obra A', mode: 'insensitive' } },
              {
                supplier: {
                  name: { contains: 'Obra A', mode: 'insensitive' },
                },
              },
              {
                project: {
                  name: { contains: 'Obra A', mode: 'insensitive' },
                },
              },
            ],
          }),
        }),
      );
    });

    it('combines supplier, project, type, status and search filters', async () => {
      const { service, purchaseOrder } = buildService();
      await service.findPaginated(
        validQuery({
          supplierId: 5,
          projectId: 10,
          purchaseOrderType: 'services',
          status: 'authorized',
          search: 'OC-2026',
        }),
      );

      const where = expect.objectContaining({
        supplierId: 5,
        projectId: 10,
        purchaseOrderType: 'services',
        status: 'authorized',
        OR: expect.any(Array),
      });
      expect(purchaseOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where }),
      );
      expect(purchaseOrder.count).toHaveBeenCalledWith({ where });
    });

    it('uses skip/take and stable descending ordering', async () => {
      const { service, purchaseOrder } = buildService();
      await service.findPaginated(validQuery({ page: 3, pageSize: 25 }));

      expect(purchaseOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 50,
          take: 25,
          orderBy: [{ createdAt: 'desc' }, { purchaseOrderId: 'desc' }],
        }),
      );
    });

    it('includes project and supplier without N+1 queries', async () => {
      const { service, purchaseOrder } = buildService();
      await service.findPaginated(validQuery());
      expect(purchaseOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ include: { project: true, supplier: true } }),
      );
    });

    it('returns the Spanish status plus its internal status code', async () => {
      const { service } = buildService();
      const result = await service.findPaginated(validQuery());
      expect(result.data.items[0]).toEqual(
        expect.objectContaining({ status: 'Pendiente', statusCode: 'pending' }),
      );
    });

    it('performs only read operations', async () => {
      const { service, purchaseOrder } = buildService();
      await service.findPaginated(validQuery());
      expect(Object.keys(purchaseOrder).sort()).toEqual(['count', 'findMany']);
    });
  });

  describe('controller and permission compatibility', () => {
    const controllerSource = readFileSync(
      resolve('src/purchase-order/purchase-order.controller.ts'),
      'utf8',
    );

    it('registers paginated before the dynamic id route', () => {
      expect(controllerSource.indexOf("@Get('paginated')")).toBeGreaterThan(-1);
      expect(controllerSource.indexOf("@Get('paginated')")).toBeLessThan(
        controllerSource.indexOf("@Get(':id')"),
      );
    });

    it('protects the global listing with orders.view', () => {
      expect(
        endpointPermissions('PurchaseOrderController', 'findPaginated', 'GET'),
      ).toEqual([['orders.view'], ['orders.view']]);
    });

    it('keeps existing directory and project endpoints', () => {
      expect(controllerSource).toContain("@Get('directory')");
      expect(controllerSource).toContain("@Get('project/:projectId')");
      expect(controllerSource).toContain(
        "@Get('project/:projectId/paginated')",
      );
    });
  });
});
