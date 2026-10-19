import { NotificationService } from 'src/notification/notification.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { PurchaseOrderService } from './purchase-order.service';

describe('Purchase order supplier abbreviation', () => {
  const purchaseOrder = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  };
  const supplier = { findUnique: jest.fn() };
  const prisma = Object.assign(
    Object.create(PrismaService.prototype) as PrismaService,
    { purchaseOrder, supplier },
  );
  const service = new PurchaseOrderService(prisma, {} as NotificationService);
  const year = new Date().getFullYear();

  beforeEach(() => {
    jest.resetAllMocks();
    Object.assign(prisma, {
      $transaction: (run: (tx: unknown) => unknown) =>
        run({ purchaseOrder, supplier, $executeRaw: jest.fn() }),
    });
  });

  it('usa la abreviatura guardada y mantiene el correlativo anual', async () => {
    purchaseOrder.findUnique.mockResolvedValue({
      code: '2208',
      supplier: { abbreviation: 'MANUAL1234' },
    });
    purchaseOrder.findMany.mockResolvedValue([
      { code: `No 007-${year}/2208/OLD` },
    ]);
    expect(await service.formatedCode(1, '2208')).toBe(
      `No 008-${year}/2208/MANUAL1234`,
    );
  });

  it('conserva un código emitido incluso si cambió el año o la abreviatura', async () => {
    const code = 'No 001-2020/2208/ANTIGUO';
    purchaseOrder.findUnique.mockResolvedValue({
      code,
      supplier: { abbreviation: 'NUEVO' },
    });
    expect(await service.formatedCode(1, 'OTRO', 2)).toBe(code);
    expect(purchaseOrder.findMany).not.toHaveBeenCalled();
    expect(supplier.findUnique).not.toHaveBeenCalled();
  });

  it.each(['A&B-S.A.C.', 'A_+@#%()!?'])(
    'preserves symbols in generated codes: %s',
    async (abbreviation) => {
      purchaseOrder.findUnique.mockResolvedValue({
        code: '2208',
        supplier: { abbreviation },
      });
      supplier.findUnique.mockResolvedValue({ abbreviation });
      purchaseOrder.findMany.mockResolvedValue([
        { code: `No 007-${year}/2208/OLD` },
      ]);
      expect(await service.formatedCode(1, '2208')).toBe(
        `No 008-${year}/2208/${abbreviation}`,
      );
      // The transactional allocator is shared by complete creation and duplication.
      const allocator = service as unknown as {
        allocateCode: (
          tx: unknown,
          baseCode: string,
          supplierId: number,
        ) => Promise<string>;
      };
      expect(
        await allocator.allocateCode(
          { supplier, purchaseOrder },
          'COPY-2208',
          1,
        ),
      ).toBe(`No 008-${year}/COPY-2208/${abbreviation}`);
    },
  );

  it('no genera una orden con una abreviatura vacía', async () => {
    purchaseOrder.findUnique.mockResolvedValue({
      code: '2208',
      supplier: { abbreviation: '' },
    });
    await expect(service.formatedCode(1, '2208')).rejects.toThrow(
      'abreviatura válida',
    );
  });

  it('edita la referencia conservando correlativo, año y sufijo histórico', async () => {
    purchaseOrder.findUnique.mockResolvedValue({
      code: 'No 237-2020/2226/ANTIGUO',
    });
    purchaseOrder.update.mockResolvedValue({
      purchaseOrderId: 1,
      code: 'CODIGO-LEGADO',
    });
    await service.update(1, { code: ' 2226-1 ', supplierId: 2 });
    const calls = purchaseOrder.update.mock.calls as Array<
      [{ data: Record<string, unknown> }]
    >;
    expect(calls[0][0].data).toEqual({
      supplierId: 2,
      code: 'No 237-2020/2226-1/ANTIGUO',
    });
    expect(purchaseOrder.findMany).not.toHaveBeenCalled();
  });

  it('conserva el código si solo cambia el proveedor', async () => {
    purchaseOrder.update.mockResolvedValue({ purchaseOrderId: 1 });
    await service.update(1, { supplierId: 2 });
    expect(purchaseOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { supplierId: 2 } }),
    );
    expect(purchaseOrder.findUnique).not.toHaveBeenCalled();
  });

  it.each(['', ' ', 'No 999-2026/OTRO/ABC'])(
    'rechaza una referencia inválida: %s',
    async (code) => {
      await expect(service.update(1, { code })).rejects.toThrow();
      expect(purchaseOrder.update).not.toHaveBeenCalled();
    },
  );

  it('rechaza un formato histórico desconocido sin sobrescribirlo', async () => {
    purchaseOrder.findUnique.mockResolvedValue({ code: 'CODIGO-LEGADO' });
    await expect(service.update(1, { code: 'NUEVO' })).rejects.toThrow(
      'formato esperado',
    );
    expect(purchaseOrder.update).not.toHaveBeenCalled();
  });
});
