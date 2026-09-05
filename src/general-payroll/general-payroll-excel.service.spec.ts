import * as ExcelJS from 'exceljs';
import { PrismaService } from 'src/prisma/prisma.service';
import { GeneralPayrollExcelService } from './general-payroll-excel.service';

describe('GeneralPayrollExcelService', () => {
  it('creates project and summary sheets with editable payroll formulas', async () => {
    const payroll = {
      generalPayrollId: 1,
      weekId: 9,
      week: {
        weekId: 9,
        startDate: new Date('2026-09-14T00:00:00.000Z'),
        endDate: new Date('2026-09-20T00:00:00.000Z'),
      },
      projects: [
        {
          generalPayrollProjectId: 11,
          generalPayrollId: 1,
          projectId: 3,
          displayOrder: 0,
          project: { projectId: 3, code: 'P-003', name: 'Proyecto prueba' },
          entries: [
            {
              generalPayrollEntryId: 20,
              generalPayrollProjectId: 11,
              generalPayrollWorkerId: 15,
              isActive: true,
              monday: 1,
              tuesday: 1,
              wednesday: 0,
              thursday: 0,
              friday: 0,
              saturday: 0,
              dominical: 1,
              overtimeAmount: 20,
              afpDiscount: 10,
              advanceDiscount: 5,
            },
          ],
        },
      ],
      workers: [
        {
          generalPayrollWorkerId: 15,
          generalPayrollId: 1,
          workerId: 7,
          group: 'laborer',
          displayOrder: 0,
          dailyWage: 100,
          additionalAmount: 12,
          liquidationAmount: 8,
          sundayDinnerAmount: 5,
          worker: {
            workerId: 7,
            fullName: 'Ana Pérez',
            dni: '01234567',
          },
        },
      ],
    };
    const prisma = {
      generalPayroll: { findUnique: jest.fn().mockResolvedValue(payroll) },
      week: { findUnique: jest.fn() },
    } as unknown as PrismaService;
    const service = new GeneralPayrollExcelService(prisma);

    const result = await service.generateWeekWorkbook(9);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(result.buffer);

    expect(result.fileName).toBe('planilla_2026-09-14_al_2026-09-20.xlsx');
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'P-003',
      'GENERAL',
      'TRABAJADORES',
    ]);
    expect(workbook.getWorksheet('P-003')?.getCell('K7').formula).toBe(
      'SUM(D7:J7)',
    );
    expect(workbook.getWorksheet('P-003')?.getCell('N7').formula).toBe(
      '(K7*L7)+M7',
    );
    expect(workbook.getWorksheet('P-003')?.getCell('Q7').formula).toBe(
      'N7-O7-P7',
    );
    expect(workbook.getWorksheet('GENERAL')?.getCell('D7').formula).toContain(
      "SUMIF('P-003'!$C:$C,$C7,'P-003'!$D:$D)",
    );
    expect(workbook.getWorksheet('GENERAL')?.getCell('U7').formula).toBe(
      'Q7+R7+S7+T7',
    );
    expect(workbook.getWorksheet('TRABAJADORES')?.getCell('B2').value).toBe(
      '01234567',
    );

    // Check the saved XLSX, including formula cells and group totals.
    for (const sheetName of ['P-003', 'GENERAL']) {
      const sheet = workbook.getWorksheet(sheetName)!;
      for (const rowNumber of [7, 8]) {
        for (let column = 4; column <= 11; column++) {
          expect(sheet.getCell(rowNumber, column).numFmt).toBe('0');
        }
        for (let column = 12; column <= 17; column++) {
          expect(sheet.getCell(rowNumber, column).numFmt).toBe(
            '"S/ "#,##0.00;[Red]-"S/ "#,##0.00',
          );
        }
      }
      expect(sheet.getCell('D7').result ?? sheet.getCell('D7').value).toBe(1);
      expect(sheet.getCell('F7').result ?? sheet.getCell('F7').value).toBe(0);
      expect(sheet.getCell('K7').result).toBe(3);
    }
    expect(workbook.getWorksheet('GENERAL')?.getCell('U7').numFmt).toBe(
      '"S/ "#,##0.00;[Red]-"S/ "#,##0.00',
    );
    expect(workbook.getWorksheet('TRABAJADORES')?.getCell('D2').numFmt).toBe(
      '"S/ "#,##0.00;[Red]-"S/ "#,##0.00',
    );
  });
});
