import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as ExcelJS from 'exceljs';

interface WorkerData {
  workerId: number;
  workerName: string;
  dni: string;
  workerType: string;
  attendancesByDay: { [key: string]: number }; // L, M, MI, J, V, S, D
  dominpicolDays: number;
  totalAttendances: number;
  dailyWage: number;
  grossAmount: number;
  netAmount: number;
}

interface ProjectSheetData {
  projectName: string;
  weekLabel: string;
  laborers: WorkerData[];
  technicians: WorkerData[];
  laborersTotals: {
    totalGross: number;
    totalNet: number;
  };
  techniciansTotals: {
    totalGross: number;
    totalNet: number;
  };
}

@Injectable()
export class ExcelService {
  private readonly logger = new Logger('ExcelService');

  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Genera un Excel con la planilla semanal por proyectos
   */
  async generateWeeklyPayrollExcel(weekId: number): Promise<Buffer> {
    this.logger.log(`Generating weekly payroll Excel for weekId=${weekId}`);

    // Obtener datos de la semana
    const week = await this.prismaService.week.findUnique({
      where: { weekId },
    });

    if (!week) {
      throw new Error('Semana no encontrada');
    }

    // Formatear label de la semana
    const weekLabel = this.formatWeekLabel(week.startDate, week.endDate);

    // Obtener todas las asistencias de la semana con sus relaciones
    const attendances = await this.prismaService.attendance.findMany({
      where: { weekId },
      include: {
        worker: {
          select: {
            workerId: true,
            fullName: true,
            dni: true,
            workerType: true,
            dailyWages: {
              where: {
                validFromDate: {
                  lte: week.startDate,
                },
              },
              orderBy: {
                validFromDate: 'desc',
              },
              take: 1,
            },
          },
        },
        project: {
          select: {
            projectId: true,
            name: true,
          },
        },
      },
    });

    // Agrupar por proyecto
    const projectsMap = new Map<
      number,
      {
        projectName: string;
        workers: Map<
          number,
          {
            worker: (typeof attendances)[0]['worker'];
            attendances: (typeof attendances)[0][];
          }
        >;
      }
    >();

    for (const attendance of attendances) {
      if (!projectsMap.has(attendance.projectId)) {
        projectsMap.set(attendance.projectId, {
          projectName: attendance.project.name,
          workers: new Map(),
        });
      }

      const project = projectsMap.get(attendance.projectId)!;
      if (!project.workers.has(attendance.workerId)) {
        project.workers.set(attendance.workerId, {
          worker: attendance.worker,
          attendances: [],
        });
      }

      project.workers.get(attendance.workerId)!.attendances.push(attendance);
    }

    // Construir datos por proyecto
    const projectsData: ProjectSheetData[] = [];
    const generalLaborers: WorkerData[] = [];
    const generalTechnicians: WorkerData[] = [];

    for (const [, projectData] of projectsMap) {
      const laborers: WorkerData[] = [];
      const technicians: WorkerData[] = [];

      for (const [workerId, workerData] of projectData.workers) {
        const { worker, attendances: workerAttendances } = workerData;

        // Calcular asistencias por día
        const attendancesByDay = this.calculateAttendancesByDay(
          workerAttendances,
          week.startDate,
        );
        const dominicalDays = attendancesByDay['D'] || 0;
        const totalAttendances = workerAttendances.length;

        const dailyWage =
          worker.dailyWages.length > 0
            ? Number(worker.dailyWages[0].amount)
            : 0;

        const grossAmount = totalAttendances * dailyWage;
        const netAmount = grossAmount;

        const workerRow: WorkerData = {
          workerId,
          workerName: worker.fullName,
          dni: worker.dni,
          workerType: worker.workerType,
          attendancesByDay,
          dominpicolDays: dominicalDays,
          totalAttendances,
          dailyWage,
          grossAmount,
          netAmount,
        };

        // Clasificar por tipo de trabajador
        if (worker.workerType === 'technician' || worker.workerType === 'engineer') {
          technicians.push(workerRow);
        } else {
          laborers.push(workerRow);
        }
      }

      // Calcular totales por tipo
      const laborersTotals = this.calculateTotals(laborers);
      const techniciansTotals = this.calculateTotals(technicians);

      projectsData.push({
        projectName: projectData.projectName,
        weekLabel,
        laborers,
        technicians,
        laborersTotals,
        techniciansTotals,
      });

      // Agregar al general
      generalLaborers.push(...laborers);
      generalTechnicians.push(...technicians);
    }

    // Crear el Excel
    const workbook = new ExcelJS.Workbook();

    // Crear hojas por proyecto
    for (const project of projectsData) {
      const sheetName = this.sanitizeSheetName(project.projectName);
      // Ordenar trabajadores alfabéticamente
      const sortedProjectData = this.sortWorkersAlphabetically(project);
      this.createProjectSheet(workbook, sheetName, sortedProjectData);
    }

    // Crear hoja GENERAL (CON descuentos reales)
    const generalData: ProjectSheetData = {
      projectName: 'GENERAL',
      weekLabel,
      laborers: this.consolidateWorkers(generalLaborers),
      technicians: this.consolidateWorkers(generalTechnicians),
      laborersTotals: this.calculateTotals(this.consolidateWorkers(generalLaborers)),
      techniciansTotals: this.calculateTotals(this.consolidateWorkers(generalTechnicians)),
    };
    this.createProjectSheet(workbook, 'GENERAL', generalData);

    // Generar buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Crea una hoja de Excel para un proyecto
   */
  private createProjectSheet(
    workbook: ExcelJS.Workbook,
    sheetName: string,
    data: ProjectSheetData,
  ): void {
    const sheet = workbook.addWorksheet(sheetName);

    // Configurar altura predeterminada de filas (28px ≈ 21 puntos)
    sheet.properties.defaultRowHeight = 21;

    // Configurar anchos de columnas
    sheet.columns = [
      { key: 'item', width: 5 },
      { key: 'name', width: 35 },
      { key: 'dni', width: 12 },
      { key: 'L', width: 4 },
      { key: 'M', width: 4 },
      { key: 'MI', width: 4 },
      { key: 'J', width: 4 },
      { key: 'V', width: 4 },
      { key: 'S', width: 4 },
      { key: 'D', width: 15 },
      { key: 'total', width: 6 },
      { key: 'dailyWage', width: 12 },
      { key: 'grossAmount', width: 15 },
      { key: 'afp', width: 10 },
      { key: 'advance', width: 18 },
      { key: 'net', width: 18 },
      { key: 'signature', width: 36 },
    ];

    let currentRow = 1;

    // Título del proyecto
    sheet.mergeCells(`A${currentRow}:Q${currentRow}`);
    const titleCell = sheet.getCell(`A${currentRow}`);
    titleCell.value = `PLANILLA ${data.projectName.toUpperCase()}`;
    titleCell.font = { bold: true, size: 18, italic: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    currentRow += 2;

    // Sección Obreros
    if (data.laborers.length > 0) {
      currentRow = this.addWorkerSection(
        sheet,
        currentRow,
        `Semana : ${data.weekLabel}( Obreros )`,
        data.laborers,
        data.laborersTotals,
      );
      currentRow += 2;
    }

    // Sección Técnicos
    if (data.technicians.length > 0) {
      currentRow = this.addWorkerSection(
        sheet,
        currentRow,
        `Semana : ${data.weekLabel}( Técnicos )`,
        data.technicians,
        data.techniciansTotals,
      );
      currentRow += 2;
    }

    // Total de la semana
    const totalWeek =
      data.laborersTotals.totalNet + data.techniciansTotals.totalNet;
    sheet.mergeCells(`A${currentRow}:O${currentRow}`);
    const totalLabelCell = sheet.getCell(`A${currentRow}`);
    totalLabelCell.value = 'TOTAL SEMANA';
    totalLabelCell.font = { bold: true };
    totalLabelCell.alignment = { horizontal: 'right' };
    const totalValueCell = sheet.getCell(`P${currentRow}`);
    totalValueCell.value = totalWeek;
    totalValueCell.numFmt = '#,##0.00';
    totalValueCell.font = { bold: true };
  }

  /**
   * Agrega una sección de trabajadores (obreros o técnicos)
   */
  private addWorkerSection(
    sheet: ExcelJS.Worksheet,
    startRow: number,
    sectionTitle: string,
    workers: WorkerData[],
    totals: { totalGross: number; totalNet: number },
  ): number {
    let currentRow = startRow;

    // Título de sección con fondo
    sheet.mergeCells(`A${currentRow}:Q${currentRow}`);
    const sectionCell = sheet.getCell(`A${currentRow}`);
    sectionCell.value = sectionTitle;
    sectionCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sectionCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF008080' }, // Teal color
    };
    sectionCell.alignment = { horizontal: 'center', vertical: 'middle' };
    currentRow++;

    // Encabezados
    const headers = [
      'ITEM',
      'NOMBRE Y APELLIDO',
      'DNI',
      'L',
      'M',
      'MI',
      'J',
      'V',
      'S',
      'Dominical : dias trabajado/6',
      'Total',
      'Jornal/dia S/.',
      'Pago semana',
      'AFP',
      'Dscts. por adelanto',
      'Neto a depositar',
      'Firma',
    ];

    headers.forEach((header, index) => {
      const cell = sheet.getCell(currentRow, index + 1);
      cell.value = header;
      cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF008080' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
    currentRow++;

    // Datos de trabajadores
    workers.forEach((worker, index) => {
      const rowData = [
        index + 1,
        worker.workerName,
        worker.dni,
        worker.attendancesByDay['L'] || 0,
        worker.attendancesByDay['M'] || 0,
        worker.attendancesByDay['MI'] || 0,
        worker.attendancesByDay['J'] || 0,
        worker.attendancesByDay['V'] || 0,
        worker.attendancesByDay['S'] || 0,
        worker.dominpicolDays > 0 ? (worker.dominpicolDays / 6).toFixed(2) : '',
        null, // Total - será fórmula
        worker.dailyWage,
        null, // Pago semana - será fórmula (Total * Jornal/dia)
        '', // AFP - columna vacía
        '', // Dscts. por adelanto - columna vacía
        null, // Neto a depositar - será fórmula (Pago semana - AFP - Dscts)
        '', // Firma
      ];

      rowData.forEach((value, colIndex) => {
        const cell = sheet.getCell(currentRow, colIndex + 1);
        
        // Columna K (índice 10) = Total, usar fórmula SUM de días L a S (columnas D a I)
        if (colIndex === 10) {
          cell.value = { formula: `SUM(D${currentRow}:I${currentRow})` };
        } 
        // Columna M (índice 12) = Pago semana, usar fórmula Total * Jornal/dia (K * L)
        else if (colIndex === 12) {
          cell.value = { formula: `K${currentRow}*L${currentRow}` };
        }
        // Columna P (índice 15) = Neto a depositar, usar fórmula Pago semana - AFP - Dscts (M - N - O)
        else if (colIndex === 15) {
          cell.value = { formula: `M${currentRow}-N${currentRow}-O${currentRow}` };
        } else {
          cell.value = value;
        }
        
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };

        // Formato numérico para montos
        if (colIndex >= 11 && colIndex <= 15) {
          cell.numFmt = '#,##0.00';
        }
      });

      currentRow++;
    });

    // Fila de totales con fórmulas
    const totalRow = currentRow;
    sheet.mergeCells(`A${totalRow}:C${totalRow}`);
    const totalLabelCell = sheet.getCell(`A${totalRow}`);
    totalLabelCell.value = 'TOTAL S/.';
    totalLabelCell.font = { bold: true };
    totalLabelCell.alignment = { horizontal: 'right' };

    // Calcular rango de datos para las fórmulas
    const dataStartRow = startRow + 2; // Fila donde empiezan los datos (después del título y encabezados)
    const dataEndRow = currentRow - 1; // Última fila de datos

    // Columnas de días: D=4 (L), E=5 (M), F=6 (MI), G=7 (J), H=8 (V), I=9 (S)
    const dayColumns = ['D', 'E', 'F', 'G', 'H', 'I'];
    dayColumns.forEach((colLetter, idx) => {
      const cell = sheet.getCell(totalRow, 4 + idx);
      cell.value = { formula: `SUM(${colLetter}${dataStartRow}:${colLetter}${dataEndRow})` };
      cell.font = { bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    // Columna J (Dominical) - dejar vacía o con borde
    const dominicalCell = sheet.getCell(totalRow, 10);
    dominicalCell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };

    // Columna K (Total) = SUM de totales de asistencias
    const totalAttendanceCell = sheet.getCell(totalRow, 11);
    totalAttendanceCell.value = { formula: `SUM(K${dataStartRow}:K${dataEndRow})` };
    totalAttendanceCell.font = { bold: true };
    totalAttendanceCell.alignment = { horizontal: 'center', vertical: 'middle' };
    totalAttendanceCell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };

    // Columna L (Jornal/dia) - dejar vacía o con borde
    const dailyWageCell = sheet.getCell(totalRow, 12);
    dailyWageCell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };

    // Columnas de montos: M=13 (grossAmount), N=14 (AFP), O=15 (advance), P=16 (net)
    const moneyColumns = ['M', 'N', 'O', 'P'];
    moneyColumns.forEach((colLetter, idx) => {
      const cell = sheet.getCell(totalRow, 13 + idx);
      cell.value = { formula: `SUM(${colLetter}${dataStartRow}:${colLetter}${dataEndRow})` };
      cell.numFmt = '#,##0.00';
      cell.font = { bold: true };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    // Columna Q (Firma) - dejar vacía con borde
    const signatureCell = sheet.getCell(totalRow, 17);
    signatureCell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };

    return currentRow + 1;
  }

  /**
   * Calcula las asistencias por día de la semana
   */
  private calculateAttendancesByDay(
    attendances: { date: Date }[],
    weekStartDate: Date,
  ): { [key: string]: number } {
    const days: { [key: string]: number } = {
      L: 0,
      M: 0,
      MI: 0,
      J: 0,
      V: 0,
      S: 0,
      D: 0,
    };

    const dayMap = ['D', 'L', 'M', 'MI', 'J', 'V', 'S'];

    for (const attendance of attendances) {
      const date = new Date(attendance.date);
      const dayOfWeek = date.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
      const dayKey = dayMap[dayOfWeek];
      days[dayKey] = (days[dayKey] || 0) + 1;
    }

    return days;
  }

  /**
   * Calcula totales de un grupo de trabajadores
   */
  private calculateTotals(workers: WorkerData[]): {
    totalGross: number;
    totalNet: number;
  } {
    return workers.reduce(
      (acc, w) => ({
        totalGross: acc.totalGross + w.grossAmount,
        totalNet: acc.totalNet + w.netAmount,
      }),
      { totalGross: 0, totalNet: 0 },
    );
  }

  /**
   * Consolida trabajadores (para la hoja GENERAL, elimina duplicados)
   * Las asistencias por día se limitan a 1 (asistió o no asistió)
   */
  private consolidateWorkers(workers: WorkerData[]): WorkerData[] {
    const workerMap = new Map<number, WorkerData>();

    for (const worker of workers) {
      if (workerMap.has(worker.workerId)) {
        const existing = workerMap.get(worker.workerId)!;
        // Consolidar asistencias por día (máximo 1 por día)
        for (const day of ['L', 'M', 'MI', 'J', 'V', 'S', 'D']) {
          const existingDay = existing.attendancesByDay[day] || 0;
          const workerDay = worker.attendancesByDay[day] || 0;
          // Si asistió en cualquier proyecto ese día, marca como 1
          existing.attendancesByDay[day] = existingDay > 0 || workerDay > 0 ? 1 : 0;
        }
        // Recalcular totales basado en asistencias consolidadas
        existing.totalAttendances = Object.values(existing.attendancesByDay).reduce((a, b) => a + b, 0);
        existing.dominpicolDays = existing.attendancesByDay['D'] || 0;
        existing.grossAmount = existing.totalAttendances * existing.dailyWage;
        existing.netAmount = existing.grossAmount;
      } else {
        workerMap.set(worker.workerId, { 
          ...worker,
          attendancesByDay: { ...worker.attendancesByDay },
        });
      }
    }

    // Ordenar alfabéticamente por nombre
    return Array.from(workerMap.values()).sort((a, b) => 
      a.workerName.localeCompare(b.workerName, 'es', { sensitivity: 'base' })
    );
  }

  /**
   * Ordena los trabajadores alfabéticamente para hojas individuales
   */
  private sortWorkersAlphabetically(project: ProjectSheetData): ProjectSheetData {
    const sortWorkers = (workers: WorkerData[]): WorkerData[] =>
      [...workers].sort((a, b) => a.workerName.localeCompare(b.workerName, 'es', { sensitivity: 'base' }));

    const laborers = sortWorkers(project.laborers);
    const technicians = sortWorkers(project.technicians);

    return {
      ...project,
      laborers,
      technicians,
      laborersTotals: this.calculateTotals(laborers),
      techniciansTotals: this.calculateTotals(technicians),
    };
  }

  /**
   * Sanitiza el nombre de la hoja (máximo 31 caracteres, sin caracteres especiales)
   */
  private sanitizeSheetName(name: string): string {
    return name
      .replace(/[\\/*?[\]:]/g, '')
      .substring(0, 31);
  }

  /**
   * Formatea el label de la semana
   */
  private formatWeekLabel(startDate: Date, endDate: Date): string {
    const months = [
      'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
      'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
    ];
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    const start = new Date(startDate);
    const end = new Date(endDate);

    const startDay = days[start.getUTCDay()];
    const startNum = start.getUTCDate();
    const endNum = end.getUTCDate();
    const month = months[start.getUTCMonth()];

    return `${startDay} ${startNum} al ${endNum} ${month}`;
  }

}
