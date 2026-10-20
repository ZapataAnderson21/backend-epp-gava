import { ConflictException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { WorkerService } from './worker.service';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';

const activeWorker = {
  workerId: 1,
  fullName: 'Ana Pérez',
  dni: '01234567',
  phone: '999888777',
  personalEmail: 'ana@example.com',
  deletedAt: null,
};

function buildService() {
  const tx = {
    worker: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ workerId: 2, ...data }),
        ),
      update: jest
        .fn()
        .mockImplementation(({ where, data }) =>
          Promise.resolve({ ...activeWorker, ...where, ...data }),
        ),
    },
  };
  const prisma = {
    worker: {
      findUnique: jest.fn().mockResolvedValue(activeWorker),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest
      .fn()
      .mockImplementation((fn: (client: typeof tx) => unknown) => fn(tx)),
  };
  const service = new WorkerService(prisma as unknown as PrismaService);
  return { service, prisma, tx };
}

const createDto = {
  fullName: 'Luis Gómez',
  dni: '76543210',
  phone: '987654321',
  personalEmail: 'luis@example.com',
  birthDate: '1990-05-10',
} as unknown as CreateWorkerDto;

describe('WorkerService uniqueness among active workers', () => {
  it('creates the worker when no active duplicate exists', async () => {
    const { service, tx, prisma } = buildService();

    const result = await service.create(createDto);

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
    expect(tx.worker.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dni: '76543210',
          deletedAt: null,
        }) as unknown,
      }),
    );
    for (const call of tx.worker.findFirst.mock.calls as [
      { where: Record<string, unknown> },
    ][]) {
      expect(call[0].where.deletedAt).toBeNull();
    }
    expect(tx.worker.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        dni: '76543210',
        phone: '987654321',
        personalEmail: 'luis@example.com',
        birthDate: new Date('1990-05-10T00:00:00.000Z'),
      }) as unknown,
    });
    expect(result.statusCode).toBe(201);
  });

  it('rejects create when an active worker has the same DNI', async () => {
    const { service, tx } = buildService();
    tx.worker.findFirst.mockImplementation(
      ({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(where.dni ? activeWorker : null),
    );

    await expect(service.create(createDto)).rejects.toThrow(
      new ConflictException('El trabajador con DNI 76543210 ya existe.'),
    );
    expect(tx.worker.create).not.toHaveBeenCalled();
  });

  it('rejects create when an active worker has the same phone', async () => {
    const { service, tx } = buildService();
    tx.worker.findFirst.mockImplementation(
      ({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(where.phone ? activeWorker : null),
    );

    await expect(service.create(createDto)).rejects.toThrow(
      new ConflictException('El trabajador con teléfono 987654321 ya existe.'),
    );
    expect(tx.worker.create).not.toHaveBeenCalled();
  });

  it('rejects update when another active worker has the new DNI', async () => {
    const { service, tx } = buildService();
    tx.worker.findFirst.mockImplementation(
      ({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(where.dni ? { ...activeWorker, workerId: 5 } : null),
    );

    await expect(
      service.update(1, { dni: '11112222' } as UpdateWorkerDto),
    ).rejects.toThrow(
      new ConflictException('El trabajador con DNI 11112222 ya existe.'),
    );
    expect(tx.worker.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          dni: '11112222',
          deletedAt: null,
          workerId: { not: 1 },
        },
      }),
    );
    expect(tx.worker.findFirst).toHaveBeenCalledTimes(1);
    expect(tx.worker.update).not.toHaveBeenCalled();
  });

  it('maps a serialization failure (P2034) to ConflictException', async () => {
    const { service, prisma } = buildService();
    prisma.$transaction.mockRejectedValue(
      Object.assign(new Error('write conflict'), { code: 'P2034' }),
    );

    await expect(service.create(createDto)).rejects.toThrow(
      new ConflictException(
        'Otro registro se está guardando al mismo tiempo. Inténtalo de nuevo.',
      ),
    );
  });
});
