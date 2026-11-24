import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { endpointPermissions } from 'src/permissions/endpoint-policy';
import { PrismaService } from 'src/prisma/prisma.service';
import { PermissionsService } from 'src/permissions/permissions.service';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { CreateRequestDto } from 'src/request/dto/create-request.dto';
import { RequestType, SsomaRequestKind } from 'src/request/enum';
import { InventoryService } from 'src/inventory/inventory.service';
import {
  CreateDeliveryDto,
  CreateDispatchDto,
  CreateReturnDto,
  ReceiveDispatchDto,
} from './dto';
import { WorkClothingService } from './work-clothing.service';

describe('Phase 6 SSOMA work-clothing contracts', () => {
  it.each([SsomaRequestKind.ProjectStart, SsomaRequestKind.DuringExecution])(
    'accepts SSOMA request kind %s',
    async (ssomaRequestKind) => {
      const dto = plainToInstance(CreateRequestDto, {
        deliveryDueDate: '2026-11-18T00:00:00.000Z',
        projectId: 1,
        type: RequestType.Epp,
        ssomaRequestKind,
      });
      expect(await validate(dto)).toHaveLength(0);
    },
  );

  it('rejects a new request without SSOMA request kind', async () => {
    const dto = plainToInstance(CreateRequestDto, {
      deliveryDueDate: '2026-11-18T00:00:00.000Z',
      projectId: 1,
      type: RequestType.Epp,
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'ssomaRequestKind')).toBe(
      true,
    );
  });

  it('requires a client idempotency key and at least one delivery line', async () => {
    const dto = plainToInstance(CreateDeliveryDto, {
      clientRequestId: 'not-a-uuid',
      projectId: 1,
      custodianUserId: 2,
      workerId: 3,
      deliveredAt: '2026-11-18T00:00:00.000Z',
      items: [],
    });
    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['clientRequestId', 'items']),
    );
  });

  it('requires every line when confirming a dispatch receipt', async () => {
    const dto = plainToInstance(ReceiveDispatchDto, { items: [] });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'items')).toBe(true);
  });

  it.each([
    [CreateDispatchDto, { quantity: 1.5 }],
    [CreateDeliveryDto, { quantity: 2.25 }],
    [CreateReturnDto, { quantity: 3.75 }],
  ])('rejects fractional garment quantities in %p', async (Dto, line) => {
    const base = {
      clientRequestId: '8caa858b-bd8d-4839-b01f-74e9f0bb59be',
      projectId: 1,
      custodianUserId: 2,
      dispatchedAt: '2026-11-18T00:00:00.000Z',
      deliveredAt: '2026-11-18T00:00:00.000Z',
      returnedAt: '2026-11-18T00:00:00.000Z',
      workerId: 3,
      items: [
        {
          officeInventoryEntryId: 4,
          custodyBalanceId: 5,
          ...line,
        },
      ],
    };
    const instance = plainToInstance(Dto as new () => object, base);
    const errors = await validate(instance);
    const itemErrors = errors.find((error) => error.property === 'items');
    expect(
      itemErrors?.children?.[0]?.children?.[0]?.constraints,
    ).toHaveProperty('isInt');
  });

  it('rejects a received quantity greater than the dispatched quantity', async () => {
    const tx = {
      workClothingDispatch: {
        findUnique: jest.fn().mockResolvedValue({
          workClothingDispatchId: 1,
          custodianUserId: 2,
          status: 'inTransit',
          items: [
            {
              workClothingDispatchItemId: 10,
              quantityDispatched: 2,
            },
          ],
        }),
        update: jest.fn(),
      },
      workClothingDispatchItem: { update: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((work: (client: typeof tx) => unknown) => work(tx)),
    };
    const service = new WorkClothingService(
      prisma as unknown as PrismaService,
      { forUser: jest.fn() } as unknown as PermissionsService,
    );
    await expect(
      service.receiveDispatch(
        1,
        {
          items: [{ dispatchItemId: 10, quantityReceived: 3 }],
          discrepancyNotes: 'Cantidad física superior al despacho.',
        },
        2,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.workClothingDispatchItem.update).not.toHaveBeenCalled();
  });

  it('protects each sensitive operation with its explicit permission', () => {
    expect(
      endpointPermissions('WorkClothingController', 'createDispatch', 'POST'),
    ).toContainEqual(['workClothing.dispatch']);
    expect(
      endpointPermissions('WorkClothingController', 'receiveDispatch', 'POST'),
    ).toContainEqual(['workClothing.receive']);
    expect(
      endpointPermissions('WorkClothingController', 'createDelivery', 'POST'),
    ).toContainEqual(['workClothing.deliver']);
    expect(
      endpointPermissions('WorkClothingController', 'deliveryPdf', 'GET'),
    ).toContainEqual(['workClothing.export']);
    expect(
      endpointPermissions('WorkClothingController', 'confirmReturn', 'POST'),
    ).toContainEqual(['workClothing.dispatch', 'workClothing.manage']);
  });

  it('rejects fractional central-stock intake for work clothing', async () => {
    const prisma = {
      element: {
        findFirst: jest.fn().mockResolvedValue({
          elementId: 1,
          family: 'uniform',
          type: 'epp',
          controlType: 'consumable',
          category: null,
        }),
      },
      elementVariant: {
        findFirst: jest.fn().mockResolvedValue({
          elementVariantId: 2,
          elementId: 1,
          label: 'M',
        }),
      },
      $transaction: jest.fn(),
    };
    const service = new InventoryService(prisma as unknown as PrismaService);
    await expect(
      service.registerOfficeEntry({
        elementId: 1,
        elementVariantId: 2,
        quantity: 1.5,
        unit: 'unidad',
        performedByUserId: 3,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('uses a non-destructive migration with unique idempotency constraints', () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        'prisma/migrations/20261118213000_add_ssoma_work_clothing_flow/migration.sql',
      ),
      'utf8',
    );
    expect(sql).toContain('WorkClothingDispatch_clientRequestId_key');
    expect(sql).toContain('WorkClothingDelivery_clientRequestId_key');
    expect(sql).toContain('WorkClothingReturn_clientRequestId_key');
    expect(sql).toContain('Missing inventory schema prerequisites for Phase 6');
    expect(sql).toContain('WorkClothingDispatchItem_quantityDispatched_check');
    expect(sql).toContain('WorkClothingDispatchItem_quantityReceived_check');
    expect(sql).toContain('WorkClothingCustodyBalance_quantities_check');
    expect(sql).toContain('WorkClothingDeliveryItem_quantity_check');
    expect(sql).toContain('WorkClothingReturnItem_quantity_check');
    expect(sql).toContain('OfficeInventoryEntry_variant_element_fkey');
    expect(sql).toContain('ElementRequest_variant_element_fkey');
    expect(sql).toContain(
      'Office inventory contains element/variant mismatches',
    );
    expect(sql).toContain('WorkClothingDispatchItem_variant_element_fkey');
    expect(sql).not.toMatch(
      /^\s*(DELETE FROM|TRUNCATE|DROP TABLE|DROP TYPE)\b/im,
    );
  });

  it('validates the selected variant pair and the custodian permission', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/work-clothing/work-clothing.service.ts'),
      'utf8',
    );
    expect(source).toContain(
      'office.elementVariant.elementId !== office.elementId',
    );
    expect(source).toContain(
      "hasSome: ['workClothing.receive', 'workClothing.manage']",
    );
  });

  it('enforces serializable stock writes and conditional central-stock decrement', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/work-clothing/work-clothing.service.ts'),
      'utf8',
    );
    expect(source).toContain('TransactionIsolationLevel.Serializable');
    expect(source).toContain('currentStock: { gte: quantity }');
    expect(source).toContain("error.code === 'P2034'");
    expect(source).toContain('clientRequestId');
  });

  it('returns the original delivery for a repeated idempotency key', async () => {
    const previous = { workClothingDeliveryId: 9, items: [] };
    const prisma = {
      workClothingDelivery: {
        findUnique: jest.fn().mockResolvedValue(previous),
      },
      $transaction: jest.fn(),
    };
    const service = new WorkClothingService(
      prisma as unknown as PrismaService,
      { forUser: jest.fn() } as unknown as PermissionsService,
    );
    const result = await service.createDelivery(
      {
        clientRequestId: '8caa858b-bd8d-4839-b01f-74e9f0bb59be',
        projectId: 1,
        custodianUserId: 2,
        workerId: 3,
        deliveredAt: '2026-11-18T00:00:00.000Z',
        items: [{ custodyBalanceId: 4, quantity: 1 }],
      },
      2,
    );
    expect(result.data).toBe(previous);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a second receipt confirmation without changing custody', async () => {
    const tx = {
      workClothingDispatch: {
        findUnique: jest.fn().mockResolvedValue({
          workClothingDispatchId: 1,
          custodianUserId: 2,
          status: 'received',
          items: [],
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn((work: (client: typeof tx) => unknown) => work(tx)),
    };
    const service = new WorkClothingService(
      prisma as unknown as PrismaService,
      { forUser: jest.fn() } as unknown as PermissionsService,
    );
    await expect(
      service.receiveDispatch(
        1,
        { items: [{ dispatchItemId: 1, quantityReceived: 1 }] },
        2,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('prevents a custodian from querying another custodian balance', async () => {
    const service = new WorkClothingService(
      {} as PrismaService,
      {
        forUser: jest.fn().mockResolvedValue(['workClothing.view']),
      } as unknown as PermissionsService,
    );
    await expect(
      service.listCustody(
        { custodianUserId: 8, page: 1, pageSize: 10, order: 'asc' },
        7,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('generates a historical delivery PDF without inventory mutations', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/pdf/pdf.service.ts'),
      'utf8',
    );
    const method = source.split('async generateWorkClothingDeliveryPdf')[1];
    expect(method).toContain('CONSTANCIA DE ENTREGA DE ROPA DE TRABAJO');
    expect(method).toContain('Firma de quien entrega');
    expect(method).toContain('Firma de quien recibe');
    expect(method).not.toContain('inventoryMovement.create');
    expect(method).not.toContain('officeInventoryEntry.update');
  });
});
