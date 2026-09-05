import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { Prisma } from 'src/generated/prisma';
import { PrismaService } from 'src/prisma/prisma.service';

const exportPayrollInclude = {
  week: true,
  projects: {
    include: { project: true, entries: true },
    orderBy: { displayOrder: 'asc' as const },
  },
  workers: {
    include: { worker: true },
    orderBy: [
      { group: 'asc' as const },
      { displayOrder: 'asc' as const },
      { generalPayrollWorkerId: 'asc' as const },
    ],
  },
};

type ExportPayroll = Prisma.GeneralPayrollGetPayload<{
  include: typeof exportPayrollInclude;
}>;
type ExportProject = ExportPayroll['projects'][number];
type ExportWorker = ExportPayroll['workers'][number];
type ExportEntry = ExportProject['entries'][number];
type WorkerGroup = 'laborer' | 'technician';

const dayFields = [
  ['monday', 'L'],
  ['tuesday', 'M'],
  ['wednesday', 'MI'],
  ['thursday', 'J'],
  ['friday', 'V'],
  ['saturday', 'S'],
  ['dominical', 'Dominical (día)'],
] as const;

const groupLabels: Record<WorkerGroup, string> = {
  laborer: 'OBREROS',
  technician: 'TÉCNICOS',
};

const projectHeaders = [
  'ITEM',
  'NOMBRE Y APELLIDO',
  'DNI',
  ...dayFields.map(([, label]) => label),
  'TOTAL',
  'JORNAL/DÍA S/.',
  'H.E.',
  'PAGO SEMANA S/.',
  'AFP',
  'DSCTO. ADELANTO',
  'NETO BASE',
  'FIRMA',
];

const generalHeaders = [
  ...projectHeaders.slice(0, -1),
  'OTROS ADICIONALES',
  'LIQUIDACIÓN',
  'COMIDA DOMINGO',
  'NETO FINAL A DEPOSITAR',
];

const navy = 'FF0F2545';
const blue = 'FF075985';
const lightBlue = 'FFE0F2FE';
const paleBlue = 'FFEAF2FF';
const white = 'FFFFFFFF';
const borderColor = 'FFCBD5E1';
// Quote the currency text: an unescaped S/ is parsed as an invalid time format.
const moneyFormat = '"S/ "#,##0.00;[Red]-"S/ "#,##0.00';
const attendanceFormat = '0';

@Injectable()
export class GeneralPayrollExcelService {
  constructor(private readonly prisma: PrismaService) {}

  async generateWeekWorkbook(
    weekId: number,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    const payroll = await this.prisma.generalPayroll.findUnique({
      where: { weekId },
      include: exportPayrollInclude,
    });

    if (!payroll) {
      const week = await this.prisma.week.findUnique({ where: { weekId } });
      if (!week) throw new NotFoundException('La semana indicada no existe.');
      throw new BadRequestException(
        'Configura la planilla de la semana antes de exportarla.',
      );
    }
    if (payroll.projects.length === 0) {
      throw new BadRequestException(
        'La planilla no tiene proyectos configurados para exportar.',
      );
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SIR GAVA';
    workbook.company = 'GAVA C & C S.R.L.';
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.calcProperties.fullCalcOnLoad = true;

    const usedSheetNames = new Set<string>(['general', 'trabajadores']);
    const projectSheetNames = new Map<number, string>();
    for (const project of payroll.projects) {
      const sheetName = this.uniqueSheetName(
        project.project.code || `PROYECTO ${project.projectId}`,
        usedSheetNames,
      );
      projectSheetNames.set(project.generalPayrollProjectId, sheetName);
      this.addProjectSheet(workbook, payroll, project, sheetName);
    }

    this.addGeneralSheet(workbook, payroll, projectSheetNames);
    this.addWorkersSheet(workbook, payroll);

    const start = this.isoDate(payroll.week.startDate);
    const end = this.isoDate(payroll.week.endDate);
    const output = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(output),
      fileName: `planilla_${start}_al_${end}.xlsx`,
    };
  }

  private addProjectSheet(
    workbook: ExcelJS.Workbook,
    payroll: ExportPayroll,
    project: ExportProject,
    sheetName: string,
  ) {
    const sheet = workbook.addWorksheet(sheetName, {
      views: [{ state: 'frozen', ySplit: 5, xSplit: 3 }],
      pageSetup: {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        paperSize: 9,
      },
    });
    this.setProjectColumns(sheet);
    this.addSheetHeading(
      sheet,
      projectHeaders.length,
      'PLANILLA DE OBRA',
      `PROYECTO: ${project.project.code} — ${project.project.name}`,
      payroll,
    );

    let nextRow = 5;
    for (const group of ['laborer', 'technician'] as const) {
      const workers = payroll.workers.filter(
        (worker) =>
          worker.group === group && this.entryFor(project, worker)?.isActive,
      );
      this.sortWorkersByName(workers);
      nextRow = this.addProjectGroup(sheet, project, workers, group, nextRow);
      nextRow += 2;
    }
    sheet.pageSetup.printArea = `A1:R${Math.max(1, nextRow - 2)}`;
  }

  private addProjectGroup(
    sheet: ExcelJS.Worksheet,
    project: ExportProject,
    workers: ExportWorker[],
    group: WorkerGroup,
    startRow: number,
  ) {
    const sectionRow = sheet.getRow(startRow);
    sheet.mergeCells(startRow, 1, startRow, projectHeaders.length);
    sectionRow.getCell(1).value = groupLabels[group];
    this.styleSectionRow(sectionRow);

    const headerRowNumber = startRow + 1;
    const headerRow = sheet.getRow(headerRowNumber);
    headerRow.values = projectHeaders;
    this.styleHeaderRow(headerRow);

    let rowNumber = headerRowNumber + 1;
    workers.forEach((worker, index) => {
      const entry = this.entryFor(project, worker)!;
      const totalDays = this.totalDays(entry);
      const gross =
        totalDays * Number(worker.dailyWage) + Number(entry.overtimeAmount);
      const net =
        gross - Number(entry.afpDiscount) - Number(entry.advanceDiscount);
      const row = sheet.getRow(rowNumber);
      row.values = [
        index + 1,
        worker.worker.fullName,
        worker.worker.dni,
        ...dayFields.map(([field]) => Number(entry[field])),
        { formula: `SUM(D${rowNumber}:J${rowNumber})`, result: totalDays },
        Number(worker.dailyWage),
        Number(entry.overtimeAmount),
        {
          formula: `(K${rowNumber}*L${rowNumber})+M${rowNumber}`,
          result: gross,
        },
        Number(entry.afpDiscount),
        Number(entry.advanceDiscount),
        {
          formula: `N${rowNumber}-O${rowNumber}-P${rowNumber}`,
          result: net,
        },
        '',
      ];
      this.styleDataRow(row, projectHeaders.length);
      row.getCell(3).numFmt = '@';
      rowNumber++;
    });

    if (workers.length === 0) {
      sheet.mergeCells(rowNumber, 1, rowNumber, projectHeaders.length);
      const emptyRow = sheet.getRow(rowNumber);
      emptyRow.getCell(1).value =
        `No hay ${groupLabels[group].toLowerCase()} asignados.`;
      emptyRow.getCell(1).alignment = { horizontal: 'center' };
      emptyRow.getCell(1).font = { italic: true, color: { argb: 'FF64748B' } };
      this.applyBorders(emptyRow, projectHeaders.length);
      rowNumber++;
    }

    this.addTotalsRow(
      sheet,
      rowNumber,
      headerRowNumber + 1,
      rowNumber - 1,
      false,
    );
    return rowNumber + 1;
  }

  private addGeneralSheet(
    workbook: ExcelJS.Workbook,
    payroll: ExportPayroll,
    projectSheetNames: Map<number, string>,
  ) {
    const sheet = workbook.addWorksheet('GENERAL', {
      views: [{ state: 'frozen', ySplit: 5, xSplit: 3 }],
      pageSetup: {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        paperSize: 9,
      },
    });
    this.setGeneralColumns(sheet);
    this.addSheetHeading(
      sheet,
      generalHeaders.length,
      'PLANILLA GENERAL',
      `PROYECTOS: ${payroll.projects.map(({ project }) => project.code).join(' · ')}`,
      payroll,
    );

    let nextRow = 5;
    for (const group of ['laborer', 'technician'] as const) {
      const workers = payroll.workers.filter(
        (worker) => worker.group === group,
      );
      this.sortWorkersByName(workers);
      nextRow = this.addGeneralGroup(
        sheet,
        payroll,
        projectSheetNames,
        workers,
        group,
        nextRow,
      );
      nextRow += 2;
    }
    sheet.pageSetup.printArea = `A1:U${Math.max(1, nextRow - 2)}`;
  }

  private addGeneralGroup(
    sheet: ExcelJS.Worksheet,
    payroll: ExportPayroll,
    projectSheetNames: Map<number, string>,
    workers: ExportWorker[],
    group: WorkerGroup,
    startRow: number,
  ) {
    const sectionRow = sheet.getRow(startRow);
    sheet.mergeCells(startRow, 1, startRow, generalHeaders.length);
    sectionRow.getCell(1).value = groupLabels[group];
    this.styleSectionRow(sectionRow);

    const headerRowNumber = startRow + 1;
    const headerRow = sheet.getRow(headerRowNumber);
    headerRow.values = generalHeaders;
    this.styleHeaderRow(headerRow);

    let rowNumber = headerRowNumber + 1;
    workers.forEach((worker, index) => {
      const entries = payroll.projects
        .map((project) => this.entryFor(project, worker))
        .filter((entry): entry is ExportEntry => Boolean(entry?.isActive));
      const days = dayFields.map(([field]) =>
        entries.reduce((sum, entry) => sum + Number(entry[field]), 0),
      );
      const totalDays = days.reduce((sum, value) => sum + value, 0);
      const overtime = entries.reduce(
        (sum, entry) => sum + Number(entry.overtimeAmount),
        0,
      );
      const afp = entries.reduce(
        (sum, entry) => sum + Number(entry.afpDiscount),
        0,
      );
      const advance = entries.reduce(
        (sum, entry) => sum + Number(entry.advanceDiscount),
        0,
      );
      const gross = totalDays * Number(worker.dailyWage) + overtime;
      const net = gross - afp - advance;
      const finalNet =
        net +
        Number(worker.additionalAmount) +
        Number(worker.liquidationAmount) +
        Number(worker.sundayDinnerAmount);

      const attendanceCells = dayFields.map((_, dayIndex) => ({
        formula: this.generalAttendanceFormula(
          payroll,
          projectSheetNames,
          rowNumber,
          dayIndex + 4,
        ),
        result: days[dayIndex],
      }));
      const row = sheet.getRow(rowNumber);
      row.values = [
        index + 1,
        worker.worker.fullName,
        worker.worker.dni,
        ...attendanceCells,
        { formula: `SUM(D${rowNumber}:J${rowNumber})`, result: totalDays },
        Number(worker.dailyWage),
        overtime,
        {
          formula: `(K${rowNumber}*L${rowNumber})+M${rowNumber}`,
          result: gross,
        },
        afp,
        advance,
        {
          formula: `N${rowNumber}-O${rowNumber}-P${rowNumber}`,
          result: net,
        },
        Number(worker.additionalAmount),
        Number(worker.liquidationAmount),
        Number(worker.sundayDinnerAmount),
        {
          formula: `Q${rowNumber}+R${rowNumber}+S${rowNumber}+T${rowNumber}`,
          result: finalNet,
        },
      ];
      this.styleDataRow(row, generalHeaders.length);
      row.getCell(3).numFmt = '@';
      rowNumber++;
    });

    if (workers.length === 0) {
      sheet.mergeCells(rowNumber, 1, rowNumber, generalHeaders.length);
      const emptyRow = sheet.getRow(rowNumber);
      emptyRow.getCell(1).value =
        `No hay ${groupLabels[group].toLowerCase()} asignados.`;
      emptyRow.getCell(1).alignment = { horizontal: 'center' };
      emptyRow.getCell(1).font = { italic: true, color: { argb: 'FF64748B' } };
      this.applyBorders(emptyRow, generalHeaders.length);
      rowNumber++;
    }

    this.addTotalsRow(
      sheet,
      rowNumber,
      headerRowNumber + 1,
      rowNumber - 1,
      true,
    );
    return rowNumber + 1;
  }

  private addWorkersSheet(workbook: ExcelJS.Workbook, payroll: ExportPayroll) {
    const sheet = workbook.addWorksheet('TRABAJADORES', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    sheet.columns = [
      { width: 38 },
      { width: 16 },
      { width: 18 },
      { width: 16 },
    ];
    const header = sheet.getRow(1);
    header.values = ['NOMBRE Y APELLIDO', 'DNI', 'TIPO', 'JORNAL/DÍA S/.'];
    this.styleHeaderRow(header);
    payroll.workers.forEach((worker, index) => {
      const row = sheet.getRow(index + 2);
      row.values = [
        worker.worker.fullName,
        worker.worker.dni,
        worker.group === 'laborer' ? 'Obrero' : 'Técnico',
        Number(worker.dailyWage),
      ];
      this.styleDataRow(row, 4);
      row.getCell(2).numFmt = '@';
      row.getCell(4).numFmt = moneyFormat;
    });
    sheet.autoFilter = `A1:D${Math.max(1, payroll.workers.length + 1)}`;
  }

  private addSheetHeading(
    sheet: ExcelJS.Worksheet,
    columnCount: number,
    title: string,
    subtitle: string,
    payroll: ExportPayroll,
  ) {
    sheet.mergeCells(1, 1, 1, columnCount);
    sheet.getCell(1, 1).value = title;
    sheet.getCell(1, 1).font = { bold: true, size: 16, color: { argb: white } };
    sheet.getCell(1, 1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: navy },
    };
    sheet.getCell(1, 1).alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    sheet.getRow(1).height = 28;

    sheet.mergeCells(2, 1, 2, columnCount);
    sheet.getCell(2, 1).value = subtitle;
    sheet.getCell(2, 1).font = { bold: true, color: { argb: blue } };
    sheet.getCell(2, 1).alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };

    sheet.mergeCells(3, 1, 3, columnCount);
    sheet.getCell(3, 1).value =
      `Semana: ${this.displayDate(payroll.week.startDate)} al ${this.displayDate(payroll.week.endDate)}`;
    sheet.getCell(3, 1).alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    sheet.getCell(3, 1).font = { italic: true, color: { argb: 'FF475569' } };
  }

  private addTotalsRow(
    sheet: ExcelJS.Worksheet,
    rowNumber: number,
    firstDataRow: number,
    lastDataRow: number,
    isGeneral: boolean,
  ) {
    const lastColumn = isGeneral ? 21 : 18;
    const row = sheet.getRow(rowNumber);
    sheet.mergeCells(rowNumber, 1, rowNumber, 3);
    row.getCell(1).value = 'TOTAL S/.';
    row.getCell(1).alignment = { horizontal: 'right' };
    const hasData = lastDataRow >= firstDataRow;
    for (let column = 4; column <= lastColumn; column++) {
      if (!isGeneral && column === 18) continue;
      row.getCell(column).value = {
        formula: hasData
          ? `SUM(${this.columnLetter(column)}${firstDataRow}:${this.columnLetter(column)}${lastDataRow})`
          : '0',
        result: 0,
      };
    }
    row.font = { bold: true, color: { argb: navy } };
    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: paleBlue },
    };
    this.applyBorders(row, lastColumn);
    this.applyFormats(row, lastColumn);
  }

  private styleSectionRow(row: ExcelJS.Row) {
    row.height = 22;
    row.font = { bold: true, color: { argb: blue } };
    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: lightBlue },
    };
    row.alignment = { vertical: 'middle' };
  }

  private styleHeaderRow(row: ExcelJS.Row) {
    row.height = 36;
    row.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: white }, size: 10 };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: blue },
      };
      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true,
      };
      cell.border = this.border();
    });
  }

  private styleDataRow(row: ExcelJS.Row, columnCount: number) {
    row.height = 24;
    this.applyBorders(row, columnCount);
    row.eachCell((cell, column) => {
      cell.alignment = {
        horizontal: column === 2 ? 'left' : 'center',
        vertical: 'middle',
        wrapText: column === 2,
      };
    });
    this.applyFormats(row, columnCount);
  }

  private applyFormats(row: ExcelJS.Row, columnCount: number) {
    for (let column = 4; column <= Math.min(11, columnCount); column++) {
      row.getCell(column).numFmt = attendanceFormat;
    }
    for (let column = 12; column <= Math.min(21, columnCount); column++) {
      row.getCell(column).numFmt = moneyFormat;
    }
  }

  private applyBorders(row: ExcelJS.Row, columnCount: number) {
    for (let column = 1; column <= columnCount; column++) {
      row.getCell(column).border = this.border();
    }
  }

  private border(): Partial<ExcelJS.Borders> {
    return {
      top: { style: 'thin', color: { argb: borderColor } },
      left: { style: 'thin', color: { argb: borderColor } },
      bottom: { style: 'thin', color: { argb: borderColor } },
      right: { style: 'thin', color: { argb: borderColor } },
    };
  }

  private setProjectColumns(sheet: ExcelJS.Worksheet) {
    sheet.columns = [
      { width: 8 },
      { width: 36 },
      { width: 15 },
      ...Array.from({ length: 6 }, () => ({ width: 7 })),
      { width: 15 },
      { width: 10 },
      ...Array.from({ length: 6 }, () => ({ width: 16 })),
      { width: 20 },
    ];
  }

  private setGeneralColumns(sheet: ExcelJS.Worksheet) {
    this.setProjectColumns(sheet);
    sheet.columns = [
      ...sheet.columns.slice(0, -1),
      { width: 18 },
      { width: 16 },
      { width: 18 },
      { width: 22 },
    ];
  }

  private entryFor(project: ExportProject, worker: ExportWorker) {
    return project.entries.find(
      (entry) => entry.generalPayrollWorkerId === worker.generalPayrollWorkerId,
    );
  }

  private sortWorkersByName(workers: ExportWorker[]) {
    workers.sort((left, right) =>
      left.worker.fullName.localeCompare(right.worker.fullName, 'es', {
        sensitivity: 'base',
      }),
    );
  }

  private totalDays(entry: ExportEntry) {
    return dayFields.reduce((sum, [field]) => sum + Number(entry[field]), 0);
  }

  private generalAttendanceFormula(
    payroll: ExportPayroll,
    projectSheetNames: Map<number, string>,
    rowNumber: number,
    projectDayColumn: number,
  ) {
    const dayColumn = this.columnLetter(projectDayColumn);
    return payroll.projects
      .map((project) => {
        const sheetName = projectSheetNames.get(
          project.generalPayrollProjectId,
        )!;
        const escapedName = sheetName.replace(/'/g, "''");
        return `SUMIF('${escapedName}'!$C:$C,$C${rowNumber},'${escapedName}'!$${dayColumn}:$${dayColumn})`;
      })
      .join('+');
  }

  private uniqueSheetName(rawName: string, usedNames: Set<string>) {
    const base =
      rawName
        .replace(/[\\/*?:[\]]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim() || 'PROYECTO';
    let candidate = base.slice(0, 31);
    let suffix = 2;
    while (usedNames.has(candidate.toLocaleLowerCase('es-PE'))) {
      const tail = ` (${suffix++})`;
      candidate = `${base.slice(0, 31 - tail.length)}${tail}`;
    }
    usedNames.add(candidate.toLocaleLowerCase('es-PE'));
    return candidate;
  }

  private columnLetter(column: number) {
    let value = column;
    let result = '';
    while (value > 0) {
      value--;
      result = String.fromCharCode(65 + (value % 26)) + result;
      value = Math.floor(value / 26);
    }
    return result;
  }

  private isoDate(date: Date) {
    return new Date(date).toISOString().slice(0, 10);
  }

  private displayDate(date: Date) {
    return new Intl.DateTimeFormat('es-PE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(date));
  }
}
