import { NotificationService } from 'src/notification/notification.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { Currency } from 'src/supplier/enum/currency.enum';
import { PurchaseOrderStatus, PurchaseOrderType } from './enum';
import { PurchaseOrderService } from './purchase-order.service';

describe('PurchaseOrderService dashboard', () => {
  const purchaseOrder = { findMany: jest.fn() };
  const project = { findMany: jest.fn() };
  const prisma = { purchaseOrder, project } as unknown as PrismaService;
  const notificationService = {} as NotificationService;
  const service = new PurchaseOrderService(prisma, notificationService);

  beforeEach(() => {
    jest.clearAllMocks();
    project.findMany.mockResolvedValue([
      { projectId: 1, name: 'Proyecto Norte' },
      { projectId: 2, name: 'Proyecto Sur' },
    ]);
  });

  it('agrupa indicadores, semanas y rankings sin sumar órdenes canceladas', async () => {
    purchaseOrder.findMany.mockResolvedValue([
      {
        purchaseOrderId: 1,
        code: 'No 001-2026/OC/PROV',
        purchaseOrderType: PurchaseOrderType.Materials,
        purchaseAmount: 100,
        saleAmount: 150,
        status: PurchaseOrderStatus.Pending,
        createdAt: new Date('2026-08-03T12:00:00.000Z'),
        projectId: 1,
        supplierId: 10,
        project: { projectId: 1, name: 'Proyecto Norte' },
        supplier: {
          supplierId: 10,
          name: 'Proveedor A',
          currency: Currency.PEN,
        },
      },
      {
        purchaseOrderId: 2,
        code: 'No 002-2026/OC/PROV',
        purchaseOrderType: PurchaseOrderType.Services,
        purchaseAmount: 200,
        saleAmount: 260,
        status: PurchaseOrderStatus.Delivered,
        createdAt: new Date('2026-08-10T12:00:00.000Z'),
        projectId: 2,
        supplierId: 11,
        project: { projectId: 2, name: 'Proyecto Sur' },
        supplier: {
          supplierId: 11,
          name: 'Proveedor B',
          currency: Currency.PEN,
        },
      },
      {
        purchaseOrderId: 3,
        code: 'No 003-2026/OC/PROV',
        purchaseOrderType: PurchaseOrderType.Materials,
        purchaseAmount: 500,
        saleAmount: 700,
        status: PurchaseOrderStatus.Cancelled,
        createdAt: new Date('2026-08-20T12:00:00.000Z'),
        projectId: 1,
        supplierId: 10,
        project: { projectId: 1, name: 'Proyecto Norte' },
        supplier: {
          supplierId: 10,
          name: 'Proveedor A',
          currency: Currency.PEN,
        },
      },
    ]);

    const result = await service.findDashboard({
      month: 8,
      year: 2026,
      currency: Currency.PEN,
    });

    expect(purchaseOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          createdAt: {
            gte: new Date('2026-08-01T00:00:00.000Z'),
            lt: new Date('2026-09-01T00:00:00.000Z'),
          },
          supplier: { currency: Currency.PEN },
        },
      }),
    );
    expect(result.data.totals).toEqual(
      expect.objectContaining({
        totalOrders: 3,
        pendingOrders: 1,
        deliveredOrders: 1,
        cancelledOrders: 1,
        purchaseAmount: 300,
        saleAmount: 410,
        margin: 110,
      }),
    );
    expect(result.data.weeklyTrend[0]).toEqual(
      expect.objectContaining({ week: 1, count: 1, purchaseAmount: 100 }),
    );
    expect(result.data.weeklyTrend[2]).toEqual(
      expect.objectContaining({ week: 3, count: 1, purchaseAmount: 0 }),
    );
    expect(result.data.topProjects).toEqual([
      expect.objectContaining({ id: 2, purchaseAmount: 200 }),
      expect.objectContaining({ id: 1, purchaseAmount: 100 }),
    ]);
    expect(result.data.oldestPendingOrders[0]).toEqual(
      expect.objectContaining({ purchaseOrderId: 1 }),
    );
  });

  it('separa los ingresos y gastos por materiales y servicios', async () => {
    purchaseOrder.findMany.mockResolvedValue([
      {
        purchaseOrderType: PurchaseOrderType.Materials,
        purchaseAmount: 100,
        saleAmount: 150,
        supplier: { currency: Currency.PEN },
      },
      {
        purchaseOrderType: PurchaseOrderType.Services,
        purchaseAmount: 200,
        saleAmount: 260,
        supplier: { currency: Currency.PEN },
      },
      {
        purchaseOrderType: PurchaseOrderType.Services,
        purchaseAmount: 80,
        saleAmount: 120,
        supplier: { currency: Currency.USD },
      },
    ]);

    const purchaseResult = await service.sumAllPurchaseAmountsByProject(1);
    const saleResult = await service.sumAllSalesAmountsByProject(1);

    expect(purchaseOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          projectId: 1,
          status: { not: PurchaseOrderStatus.Cancelled },
        },
      }),
    );
    expect(purchaseResult.data).toEqual({
      totalPEN: 300,
      totalUSD: 80,
      totalEUR: 0,
      byType: {
        materials: { totalPEN: 100, totalUSD: 0, totalEUR: 0 },
        services: { totalPEN: 200, totalUSD: 80, totalEUR: 0 },
      },
    });
    expect(saleResult.data).toEqual({
      totalPEN: 410,
      totalUSD: 120,
      totalEUR: 0,
      byType: {
        materials: { totalPEN: 150, totalUSD: 0, totalEUR: 0 },
        services: { totalPEN: 260, totalUSD: 120, totalEUR: 0 },
      },
    });
  });
});
