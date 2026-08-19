import { PrismaService } from 'src/prisma/prisma.service';
import { PurchaseOrderConditionType } from './enum/purchase-order-condition-type.enum';
import { PurchaseOrderConditionService } from './purchase-order-condition.service';

describe('PurchaseOrderConditionService', () => {
  const purchaseOrderCondition = {
    upsert: jest.fn(),
    findMany: jest.fn(),
  };
  const prisma = { purchaseOrderCondition } as unknown as PrismaService;
  const service = new PurchaseOrderConditionService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normaliza el contenido para evitar condiciones duplicadas', async () => {
    const savedCondition = {
      purchaseOrderConditionId: 1,
      type: PurchaseOrderConditionType.Commercial,
      content: 'Entrega rápida en obra',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    purchaseOrderCondition.upsert.mockResolvedValue(savedCondition);

    const result = await service.create({
      type: PurchaseOrderConditionType.Commercial,
      content: '  Entrega   rápida en obra  ',
    });

    expect(purchaseOrderCondition.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          type_normalizedContent: {
            type: PurchaseOrderConditionType.Commercial,
            normalizedContent: 'entrega rapida en obra',
          },
        },
        create: {
          type: PurchaseOrderConditionType.Commercial,
          content: 'Entrega rápida en obra',
          normalizedContent: 'entrega rapida en obra',
        },
      }),
    );
    expect(result.data).toEqual(savedCondition);
  });

  it('filtra las condiciones por tipo y texto sin distinguir mayúsculas', async () => {
    purchaseOrderCondition.findMany.mockResolvedValue([]);

    await service.findAll({
      type: PurchaseOrderConditionType.Quality,
      search: 'certificado',
    });

    expect(purchaseOrderCondition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          type: PurchaseOrderConditionType.Quality,
          content: {
            contains: 'certificado',
            mode: 'insensitive',
          },
        },
      }),
    );
  });
});
