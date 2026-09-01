import { PrismaService } from 'src/prisma/prisma.service';
import { PettyCashService } from './petty-cash.service';
import { PettyCashType } from './enum';

describe('PettyCashService', () => {
  const findMany = jest.fn();
  const prisma = Object.assign(
    Object.create(PrismaService.prototype) as PrismaService,
    { pettyCash: { findMany } },
  );
  const service = new PettyCashService(prisma);

  beforeEach(() => {
    findMany.mockReset();
  });

  it('adds IGV only to amounts that do not include it', async () => {
    findMany.mockResolvedValue([
      { amount: 100, includesIgv: true },
      { amount: 100, includesIgv: false },
    ]);

    await expect(service.sumAllAmountsByProject(10)).resolves.toMatchObject({
      data: 218,
    });
  });

  it('rounds totals by expense type to two decimal places', async () => {
    findMany.mockResolvedValue([{ amount: 9.99, includesIgv: false }]);

    await expect(
      service.sumAmountsByTypeAndProject(10, PettyCashType.Supplies),
    ).resolves.toMatchObject({ data: 11.79 });
    expect(findMany).toHaveBeenCalledWith({
      where: { projectId: 10, expenseType: PettyCashType.Supplies },
      select: { amount: true, includesIgv: true },
    });
  });
});
