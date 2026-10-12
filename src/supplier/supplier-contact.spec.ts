import { plainToInstance } from 'class-transformer';
import { PrismaService } from 'src/prisma/prisma.service';
import { SupplierService } from './supplier.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

describe('Supplier contact persistence', () => {
  const current = {
    supplierId: 1,
    name: 'Supplier',
    documentType: 'ruc',
    phone: '987654321',
    email: 'supplier@example.com',
  };
  const supplier = {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const service = new SupplierService({ supplier } as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
    supplier.findUnique.mockResolvedValue(current);
    supplier.update.mockImplementation(({ data }) => ({ ...current, ...data }));
  });

  it('creates without phone or email', async () => {
    supplier.findUnique.mockResolvedValue(null);
    supplier.create.mockResolvedValue({ supplierId: 1 });
    const dto = plainToInstance(CreateSupplierDto, {
      name: 'Supplier',
      abbreviation: 'SUP',
      contactName: 'Contact',
      ruc: '20123456789',
      accountNumber: '1234567890123',
      bank: 'BCP',
    });
    await service.create(dto);
    const data = supplier.create.mock.calls[0][0].data;
    expect(data.phone).toBeUndefined();
    expect(data.email).toBeUndefined();
  });

  it('does not send omitted contacts to Prisma on PATCH', async () => {
    await service.update(1, plainToInstance(UpdateSupplierDto, {}));
    expect(supplier.update).toHaveBeenCalledWith({
      where: { supplierId: 1 },
      data: {},
    });
  });

  it.each([null, '', '   '])('clears both contacts with %p', async (value) => {
    await service.update(
      1,
      plainToInstance(UpdateSupplierDto, { phone: value, email: value }),
    );
    expect(supplier.update).toHaveBeenCalledWith({
      where: { supplierId: 1 },
      data: { phone: null, email: null },
    });
  });
});
