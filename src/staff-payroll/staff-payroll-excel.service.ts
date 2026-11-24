import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { StaffPayrollService } from './staff-payroll.service';

const MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const TYPE_LABELS: Record<string, string> = {
  engineer: 'Ingeniero',
  administrator: 'Administrador(a)',
  manager: 'Gerente',
};

@Injectable()
export class StaffPayrollExcelService {
  constructor(private readonly staffPayrollService: StaffPayrollService) {}

  async generatePeriodWorkbook(year: number, month: number) {
    const data = await this.staffPayrollService.getExportData(year, month);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SIR GAVA';
    workbook.company = 'GAVA C & C S.R.L.';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Control mensual STAFF');
    sheet.views = [{ state: 'frozen', ySplit: 5 }];
    sheet.columns = [
      { key: 'worker', width: 34 },
      { key: 'dni', width: 14 },
      { key: 'type', width: 20 },
      { key: 'base', width: 18 },
      { key: 'additional', width: 18 },
      { key: 'discounts', width: 18 },
      { key: 'gross', width: 18 },
      { key: 'net', width: 18 },
      { key: 'observations', width: 38 },
    ];

    sheet.mergeCells('A1:I1');
    sheet.getCell('A1').value = 'Control mensual STAFF — GAVA C&C';
    sheet.getCell('A1').font = {
      bold: true,
      size: 16,
      color: { argb: 'FFFFFFFF' },
    };
    sheet.getCell('A1').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0047A3' },
    };
    sheet.getCell('A1').alignment = { horizontal: 'center' };
    sheet.mergeCells('A2:I2');
    sheet.getCell('A2').value =
      (MONTHS[month - 1] ?? String(month)) + ' ' + year;
    sheet.getCell('A2').font = { bold: true, size: 12 };
    sheet.getCell('A2').alignment = { horizontal: 'center' };
    sheet.mergeCells('A3:I3');
    sheet.getCell('A3').value =
      'Control interno de remuneraciones. No constituye una planilla laboral o tributaria oficial.';
    sheet.getCell('A3').font = { italic: true, color: { argb: 'FF555555' } };
    sheet.getCell('A3').alignment = { horizontal: 'center', wrapText: true };

    const headers = [
      'Trabajador',
      'DNI',
      'Tipo',
      'Remuneración base',
      'Ingresos adicionales',
      'Descuentos',
      'Total bruto',
      'Total neto',
      'Observaciones',
    ];
    const header = sheet.addRow(headers);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E5B9E' },
    };
    header.alignment = { horizontal: 'center', vertical: 'middle' };

    for (const entry of data.entries) {
      const row = sheet.addRow({
        worker: entry.workerNameSnapshot,
        dni: entry.workerDniSnapshot,
        type: TYPE_LABELS[entry.workerTypeSnapshot] ?? entry.workerTypeSnapshot,
        base: Number(entry.baseRemuneration),
        additional: Number(entry.additionalIncome),
        discounts: Number(entry.manualDiscounts),
        gross: Number(entry.grossAmount),
        net: Number(entry.netAmount),
        observations: entry.observations ?? '',
      });
      row.alignment = { vertical: 'top', wrapText: true };
    }

    const totalRow = sheet.addRow({
      worker: 'TOTALES GENERALES',
      base: Number(data.totalBaseRemuneration),
      additional: Number(data.totalAdditionalIncome),
      discounts: Number(data.totalDiscounts),
      gross: Number(data.totalGrossAmount),
      net: Number(data.totalNetAmount),
    });
    totalRow.font = { bold: true };
    totalRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFDCEBFA' },
    };

    for (let column = 4; column <= 8; column += 1) {
      sheet.getColumn(column).numFmt = '"S/ " #,##0.00';
      sheet.getColumn(column).alignment = { horizontal: 'right' };
    }
    sheet.autoFilter = { from: 'A4', to: 'I4' };
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber >= 4) {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          };
        });
      }
    });

    const output = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(output),
      fileName:
        'control_mensual_staff_' +
        year +
        '-' +
        String(month).padStart(2, '0') +
        '.xlsx',
    };
  }
}
