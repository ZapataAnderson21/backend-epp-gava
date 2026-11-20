/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Jest asymmetric matchers are intentionally untyped. */
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { endpointPermissions } from 'src/permissions/endpoint-policy';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { QuotationStatus } from './enum';
import { QuotationService } from './quotation.service';

const createdAt = new Date('2026-11-17T15:00:00.000Z');

const baseQuotation = {
  quotationId: 1,
  code: 'No 001-2026 / GAVA',
  clientId: 10,
  serviceDescription: 'Instalación de canaletas',
  type: 'works',
  status: 'draft',
  commercialTerms: null,
  costDirectAmount: 20,
  igvRate: 0.18,
  igvAmount: 3.6,
  totalAmount: 23.6,
  createdAt,
  updatedAt: createdAt,
  client: { clientId: 10, name: 'Cliente Uno' },
  items: [
    {
      quotationItemId: 1,
      quotationId: 1,
      orderNumber: 1,
      description: 'Canaleta',
      unit: 'UND',
      quantity: 2,
      unitPrice: 10,
      lineTotal: 20,
      createdAt,
      updatedAt: createdAt,
    },
  ],
};

function validCreatePayload(type?: string) {
  return {
    clientId: 10,
    serviceDescription: 'Instalación de canaletas',
    ...(type === undefined ? {} : { type }),
    items: [
      {
        description: 'Canaleta',
        unit: 'UND',
        quantity: 2,
        unitPrice: 10,
        orderNumber: 1,
      },
    ],
  };
}

function buildService() {
  let nextId = 0;
  const typesById = new Map<number, string>();
  const allocatedCodes: string[] = [];
  const events: string[] = [];

  const quotation = {
    create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
      nextId += 1;
      if (typeof data.type === 'string') typesById.set(nextId, data.type);
      events.push(`create:${nextId}`);
      return Promise.resolve({
        ...baseQuotation,
        ...data,
        quotationId: nextId,
        createdAt,
      });
    }),
    count: jest.fn(() => Promise.resolve(nextId)),
    update: jest.fn(
      ({
        where,
        data,
      }: {
        where: { quotationId: number };
        data: Record<string, unknown>;
      }) => {
        events.push(`update:${where.quotationId}`);
        if (typeof data.code === 'string') allocatedCodes.push(data.code);
        return Promise.resolve({
          ...baseQuotation,
          quotationId: where.quotationId,
          type: typesById.get(where.quotationId) ?? baseQuotation.type,
          ...data,
        });
      },
    ),
    findMany: jest.fn(),
    findUnique: jest.fn(),
  };
  const tx = {
    quotation,
    $executeRaw: jest.fn(() => {
      events.push('lock');
      return Promise.resolve(1);
    }),
  };

  let queue = Promise.resolve<unknown>(undefined);
  const $transaction = jest.fn(
    <T>(callback: (client: typeof tx) => Promise<T>): Promise<T> => {
      const run = queue.then(() => callback(tx));
      queue = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
  );
  const prisma = { quotation, $transaction };

  return {
    service: new QuotationService(prisma as never),
    quotation,
    tx,
    $transaction,
    allocatedCodes,
    events,
  };
}

describe('quotation Phase 2', () => {
  describe('DTO validation', () => {
    it.each(['works', 'services', 'consulting'])(
      'accepts the %s quotation type',
      async (type) => {
        const dto = plainToInstance(
          CreateQuotationDto,
          validCreatePayload(type),
        );

        await expect(validate(dto)).resolves.toHaveLength(0);
      },
    );

    it('rejects creation without type', async () => {
      const dto = plainToInstance(CreateQuotationDto, validCreatePayload());
      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'type')).toBe(true);
    });

    it('rejects an invalid quotation type', async () => {
      const dto = plainToInstance(
        CreateQuotationDto,
        validCreatePayload('invalid'),
      );
      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'type')).toBe(true);
    });

    it.each(['draft', 'sent', 'accepted', 'rejected'])(
      'accepts the %s quotation status on update',
      async (status) => {
        const dto = plainToInstance(UpdateQuotationDto, { status });

        await expect(validate(dto)).resolves.toHaveLength(0);
      },
    );

    it('rejects the removed approved status', async () => {
      const dto = plainToInstance(UpdateQuotationDto, { status: 'approved' });
      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'status')).toBe(true);
    });

    it('exposes exactly the four supported Phase 2 status values', () => {
      expect(Object.values(QuotationStatus).sort()).toEqual(
        ['accepted', 'draft', 'rejected', 'sent'].sort(),
      );
    });
  });

  describe('service behavior', () => {
    it.each(['works', 'services', 'consulting'])(
      'creates a %s quotation in draft and preserves calculations',
      async (type) => {
        const { service, quotation } = buildService();

        const result = await service.create(validCreatePayload(type) as never);

        expect(quotation.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              type,
              status: 'draft',
              costDirectAmount: 20,
              igvAmount: 3.6,
              totalAmount: 23.6,
            }),
          }),
        );
        expect((result.data as unknown as { type: string }).type).toBe(type);
      },
    );

    it('combines type, status, client, search and pagination filters', async () => {
      const { service, quotation } = buildService();
      quotation.findMany.mockResolvedValue([baseQuotation]);
      quotation.count.mockResolvedValue(1);

      await service.findPaginated({
        type: 'services',
        status: 'sent',
        clientId: 10,
        search: 'canaletas',
        page: 2,
        pageSize: 10,
        order: 'desc',
      } as never);

      const expectedWhere = expect.objectContaining({
        type: 'services',
        status: 'sent',
        clientId: 10,
        OR: expect.any(Array),
      });
      expect(quotation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere, skip: 10, take: 10 }),
      );
      expect(quotation.count).toHaveBeenCalledWith({ where: expectedWhere });
    });

    it('updates type without overwriting omitted fields', async () => {
      const { service, quotation } = buildService();
      quotation.findUnique.mockResolvedValue(baseQuotation);
      quotation.update.mockResolvedValue({
        ...baseQuotation,
        type: 'consulting',
      });

      await service.update(1, { type: 'consulting' } as never);

      expect(quotation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { quotationId: 1 },
          data: { type: 'consulting' },
        }),
      );
    });

    it('serializes concurrent code allocation and preserves unique sequence', async () => {
      const { service, $transaction, tx, allocatedCodes, events } =
        buildService();

      await Promise.all([
        service.create(validCreatePayload('works') as never),
        service.create(validCreatePayload('services') as never),
      ]);

      expect($transaction).toHaveBeenCalledTimes(2);
      expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
      expect(allocatedCodes).toEqual([
        'No 001-2026 / GAVA',
        'No 002-2026 / GAVA',
      ]);
      expect(events).toEqual([
        'lock',
        'create:1',
        'update:1',
        'lock',
        'create:2',
        'update:2',
      ]);
    });
  });

  describe('migration safety', () => {
    const migrationPath = resolve(
      'prisma/migrations/20261117160000_add_quotation_type_and_status/migration.sql',
    );

    it('creates the versioned migration', () => {
      expect(existsSync(migrationPath)).toBe(true);
    });

    it('checks for existing quotations before schema mutation', () => {
      expect(existsSync(migrationPath)).toBe(true);
      if (!existsSync(migrationPath)) return;

      const sql = readFileSync(migrationPath, 'utf8');
      const precondition = sql.indexOf('IF EXISTS (SELECT 1 FROM "Quotation")');
      const firstMutation = Math.min(
        ...[
          sql.indexOf('CREATE TYPE "QuotationType"'),
          sql.indexOf('ALTER TABLE "Quotation"'),
          sql.indexOf('ALTER TYPE "QuotationStatus"'),
        ].filter((index) => index >= 0),
      );

      expect(precondition).toBeGreaterThan(-1);
      expect(precondition).toBeLessThan(firstMutation);
      expect(sql).toContain('RAISE EXCEPTION');
      expect(sql).not.toMatch(/DROP\s+TABLE|TRUNCATE|DELETE\s+FROM/i);
      expect(sql).not.toMatch(/DEFAULT\s+'works'/i);
    });
  });

  describe('permissions', () => {
    it('requires view/manage/export through the existing endpoint policy', () => {
      expect(
        endpointPermissions('QuotationController', 'findOne', 'GET'),
      ).toEqual([['quotations.view'], ['quotations.view']]);
      expect(
        endpointPermissions('QuotationController', 'create', 'POST'),
      ).toEqual([['quotations.view'], ['quotations.manage']]);
      expect(
        endpointPermissions('QuotationController', 'generatePdf', 'GET'),
      ).toEqual([['quotations.view'], ['quotations.export']]);
    });
  });

  describe('quotation PDF contract', () => {
    it('renders quotation type, supported status and generic description labels', () => {
      const source = readFileSync(resolve('src/pdf/pdf.service.ts'), 'utf8');
      const quotationPdf = source.slice(
        source.indexOf('async generateQuotationPdf'),
      );

      expect(quotationPdf).toContain("works: 'Obras'");
      expect(quotationPdf).toContain("services: 'Servicios'");
      expect(quotationPdf).toContain("consulting: 'Consultorías'");
      expect(quotationPdf).toContain("rejected: 'Rechazada'");
      expect(quotationPdf).toContain("{ text: 'Descripción: ', bold: true }");
      expect(quotationPdf).toContain("{ text: 'Tipo: ', bold: true }");
      expect(quotationPdf).toContain("{ text: 'Estado: ', bold: true }");
    });
  });
});
