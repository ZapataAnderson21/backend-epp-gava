import { BadRequestException } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { WorkerType } from '../worker/enum/worker-type.enum';

export const STAFF_WORKER_TYPES = [
  WorkerType.Engineer,
  WorkerType.Administrator,
  WorkerType.Manager,
] as const;

export function isStaffWorkerType(workerType: WorkerType | string): boolean {
  return STAFF_WORKER_TYPES.includes(
    workerType as (typeof STAFF_WORKER_TYPES)[number],
  );
}

export function decimal(value: Prisma.Decimal.Value): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

export function money(value: Prisma.Decimal.Value): string {
  return decimal(value).toDecimalPlaces(2).toFixed(2);
}

export function calculateStaffPayrollTotals(
  baseRemuneration: Prisma.Decimal.Value,
  additionalIncome: Prisma.Decimal.Value,
  manualDiscounts: Prisma.Decimal.Value,
) {
  const base = decimal(baseRemuneration);
  const additional = decimal(additionalIncome);
  const discounts = decimal(manualDiscounts);
  if (base.isNegative() || additional.isNegative() || discounts.isNegative()) {
    throw new BadRequestException('Los importes no pueden ser negativos.');
  }
  const gross = base.add(additional);
  if (discounts.greaterThan(gross)) {
    throw new BadRequestException(
      'Los descuentos no pueden superar el importe bruto.',
    );
  }
  return {
    grossAmount: money(gross),
    netAmount: money(gross.sub(discounts)),
  };
}
