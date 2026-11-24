import { BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PermissionsService } from 'src/permissions/permissions.service';
import { ElementFamily } from 'src/element/enum/element-type.enum';
import { RequestService } from './request.service';

type LineValidator = (
  line: {
    elementId: number;
    elementVariantId?: number | null;
    quantity: number;
    workerPlans?: Array<{ workerId: number; quantity: number }>;
  },
  element: {
    elementId: number;
    family: string | null;
    variants: Array<{ elementVariantId: number }>;
  },
) => void;

describe('SSOMA request Phase 6.1 validation', () => {
  const service = new RequestService(
    {} as PrismaService,
    {} as never,
    {} as PermissionsService,
  );
  const validate = (
    service as unknown as { validateSsomaLine: LineValidator }
  ).validateSsomaLine.bind(service);

  const uniform = {
    elementId: 10,
    family: ElementFamily.Uniform,
    variants: [{ elementVariantId: 100 }],
  };

  it('accepts planned workers below the requested clothing quantity', () => {
    expect(() =>
      validate(
        {
          elementId: 10,
          elementVariantId: 100,
          quantity: 5,
          workerPlans: [
            { workerId: 1, quantity: 1 },
            { workerId: 2, quantity: 2 },
          ],
        },
        uniform,
      ),
    ).not.toThrow();
  });

  it('rejects a variant that belongs to another clothing item', () => {
    expect(() =>
      validate({ elementId: 10, elementVariantId: 999, quantity: 1 }, uniform),
    ).toThrow(BadRequestException);
  });

  it('rejects duplicate workers and over-allocation', () => {
    expect(() =>
      validate(
        {
          elementId: 10,
          elementVariantId: 100,
          quantity: 1,
          workerPlans: [
            { workerId: 1, quantity: 1 },
            { workerId: 1, quantity: 1 },
          ],
        },
        uniform,
      ),
    ).toThrow(BadRequestException);

    expect(() =>
      validate(
        {
          elementId: 10,
          elementVariantId: 100,
          quantity: 1,
          workerPlans: [
            { workerId: 1, quantity: 1 },
            { workerId: 2, quantity: 1 },
          ],
        },
        uniform,
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects worker planning outside work clothing', () => {
    expect(() =>
      validate(
        {
          elementId: 20,
          quantity: 1,
          workerPlans: [{ workerId: 1, quantity: 1 }],
        },
        { elementId: 20, family: ElementFamily.Epp, variants: [] },
      ),
    ).toThrow(BadRequestException);
  });
});
