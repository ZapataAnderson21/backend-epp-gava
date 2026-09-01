import { PrismaService } from 'src/prisma/prisma.service';
import { ServiceSaleService } from './service-sale.service';

describe('ServiceSaleService - ingresos registrados', () => {
  const serviceSale = {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    aggregate: jest.fn(),
  };
  const prisma = Object.assign(
    Object.create(PrismaService.prototype) as PrismaService,
    { serviceSale },
  );
  const service = new ServiceSaleService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('guarda el monto y la moneda del ingreso', async () => {
    const dto = {
      projectId: 19,
      serviceName: 'Valorización 01',
      description: 'Primer avance de obra',
      amount: 1250.5,
      currency: 'PEN' as const,
    };
    serviceSale.create.mockResolvedValue({ serviceSaleId: 1, ...dto });

    const result = await service.create(dto);
    expect(result.statusCode).toBe(201);
    expect(result.data.currency).toBe('PEN');
    expect(result.data.amount).toBe(1250.5);
    expect(serviceSale.create).toHaveBeenCalledWith({ data: dto });
  });

  it('devuelve un listado paginado filtrado por moneda', async () => {
    serviceSale.findMany.mockResolvedValue([]);
    serviceSale.count.mockResolvedValue(0);

    const result = await service.findPaginatedByProject(19, {
      page: 1,
      pageSize: 10,
      order: 'asc',
      search: 'avance',
      currency: 'USD',
    });

    expect(serviceSale.findMany).toHaveBeenCalledWith({
      where: {
        projectId: 19,
        currency: 'USD',
        OR: [
          { serviceName: { contains: 'avance', mode: 'insensitive' } },
          { description: { contains: 'avance', mode: 'insensitive' } },
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { serviceSaleId: 'desc' }],
      skip: 0,
      take: 10,
    });
    expect(result.data.items).toEqual([]);
  });

  it('agrupa los totales sin mezclar monedas', async () => {
    serviceSale.groupBy.mockResolvedValue([
      { currency: 'PEN', _sum: { amount: 100 } },
      { currency: 'USD', _sum: { amount: 25.5 } },
    ]);

    await expect(service.sumAllAmountsByCurrency(19)).resolves.toMatchObject({
      data: { PEN: 100, USD: 25.5, EUR: 0 },
    });
  });
});
