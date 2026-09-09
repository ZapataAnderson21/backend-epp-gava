import { BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  GeneralPayrollAttendanceFieldDto,
  UpdateGeneralPayrollAttendanceDto,
} from './dto/update-general-payroll-attendance.dto';
import { GeneralPayrollService } from './general-payroll.service';

describe('General payroll attendance autosave', () => {
  const target = {
    generalPayrollWorkerId: 15,
    payrollWorker: { worker: { fullName: 'Ana Pérez' } },
  };

  function fixture(findFirstResults: unknown[]) {
    const transaction = {
      $executeRaw: jest.fn(),
      generalPayrollEntry: {
        findFirst: jest
          .fn()
          .mockImplementation(() => Promise.resolve(findFirstResults.shift())),
        update: jest.fn(),
      },
    };
    const prisma = {
      generalPayroll: {
        findUnique: jest.fn().mockResolvedValue({ generalPayrollId: 1 }),
      },
      $transaction: jest.fn(async (operation) => operation(transaction)),
    } as unknown as PrismaService;
    return {
      service: new GeneralPayrollService(prisma),
      transaction,
    };
  }

  it('persists only the clicked day and returns without fetching the whole week', async () => {
    const { service, transaction } = fixture([target, null]);

    await expect(
      service.updateAttendance(9, 20, {
        field: GeneralPayrollAttendanceFieldDto.tuesday,
        value: 1,
      }),
    ).resolves.toMatchObject({
      data: { generalPayrollEntryId: 20, field: 'tuesday', value: 1 },
    });
    expect(transaction.$executeRaw).toHaveBeenCalled();
    expect(transaction.generalPayrollEntry.update).toHaveBeenCalledWith({
      where: { generalPayrollEntryId: 20 },
      data: { tuesday: 1 },
    });
  });

  it('rejects attendance already registered in another project or Services', async () => {
    const { service, transaction } = fixture([
      target,
      {
        payrollProject: {
          locationType: 'services',
          project: null,
        },
      },
    ]);

    await expect(
      service.updateAttendance(9, 20, {
        field: GeneralPayrollAttendanceFieldDto.monday,
        value: 1,
      }),
    ).rejects.toThrow('Servicios');
    expect(transaction.generalPayrollEntry.update).not.toHaveBeenCalled();
  });

  it('allows unchecking without looking for conflicts', async () => {
    const { service, transaction } = fixture([target]);
    await service.updateAttendance(9, 20, {
      field: GeneralPayrollAttendanceFieldDto.dominical,
      value: 0,
    });
    expect(transaction.generalPayrollEntry.findFirst).toHaveBeenCalledTimes(1);
    expect(transaction.generalPayrollEntry.update).toHaveBeenCalledWith({
      where: { generalPayrollEntryId: 20 },
      data: { dominical: 0 },
    });
  });

  it('does not update an entry outside the requested week or inactive', async () => {
    const { service, transaction } = fixture([null]);
    await expect(
      service.updateAttendance(9, 20, {
        field: GeneralPayrollAttendanceFieldDto.friday,
        value: 1,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(transaction.generalPayrollEntry.update).not.toHaveBeenCalled();
  });

  it('accepts only attendance fields and binary values', async () => {
    const valid = plainToInstance(UpdateGeneralPayrollAttendanceDto, {
      field: 'wednesday',
      value: 1,
    });
    const invalid = plainToInstance(UpdateGeneralPayrollAttendanceDto, {
      field: 'overtimeAmount',
      value: 0.5,
    });
    expect(await validate(valid)).toHaveLength(0);
    expect(await validate(invalid)).toHaveLength(2);
  });
});
