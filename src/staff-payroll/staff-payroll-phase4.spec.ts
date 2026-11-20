import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateWorkerDto } from '../worker/dto/create-worker.dto';
import { WorkerType } from '../worker/enum/worker-type.enum';
import {
  calculateStaffPayrollTotals,
  isStaffWorkerType,
} from './staff-payroll.calculations';
import { CreateStaffPayrollDto } from './dto/create-staff-payroll.dto';
import { UpdateStaffPayrollEntryDto } from './dto/update-staff-payroll-entry.dto';

describe('Phase 4 STAFF payroll contracts', () => {
  it.each([WorkerType.Engineer, WorkerType.Administrator, WorkerType.Manager])(
    'classifies %s as STAFF',
    (workerType) => {
      expect(isStaffWorkerType(workerType)).toBe(true);
    },
  );

  it.each([WorkerType.Laborer, WorkerType.Technician])(
    'excludes %s from STAFF',
    (workerType) => {
      expect(isStaffWorkerType(workerType)).toBe(false);
    },
  );

  it('calculates exact gross and net totals', () => {
    expect(calculateStaffPayrollTotals('2500.10', '125.35', '300.20')).toEqual({
      grossAmount: '2625.45',
      netAmount: '2325.25',
    });
  });

  it('rejects discounts above gross remuneration', () => {
    expect(() => calculateStaffPayrollTotals('1000', '0', '1000.01')).toThrow(
      'Los descuentos no pueden superar el importe bruto.',
    );
  });

  it('requires an explicit valid worker type on create', async () => {
    const missing = plainToInstance(CreateWorkerDto, {
      fullName: 'Ana Torres',
      dni: '12345678',
    });
    const legacy = plainToInstance(CreateWorkerDto, {
      fullName: 'Ana Torres',
      dni: '12345678',
      workerType: 'unspecified',
    });
    expect(await validate(missing)).not.toHaveLength(0);
    expect(await validate(legacy)).not.toHaveLength(0);
  });

  it('validates unique monthly period boundaries', async () => {
    const valid = plainToInstance(CreateStaffPayrollDto, {
      year: 2026,
      month: 11,
    });
    const invalid = plainToInstance(CreateStaffPayrollDto, {
      year: 2026,
      month: 13,
    });
    expect(await validate(valid)).toHaveLength(0);
    expect(await validate(invalid)).not.toHaveLength(0);
  });

  it('rejects negative adjustments', async () => {
    const dto = plainToInstance(UpdateStaffPayrollEntryDto, {
      additionalIncome: -1,
    });
    expect(await validate(dto)).not.toHaveLength(0);
  });
});
