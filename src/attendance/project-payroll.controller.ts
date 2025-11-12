// project-payroll.controller.ts  (Planillas DENTRO DE UN PROYECTO)
import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { AttendanceService } from './attendance.service';

function formatWeekLabel(start: Date, end: Date, locale = 'es-PE') {
  const fmt = new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'long' });
  return `${fmt.format(start)} - ${fmt.format(end)}`;
}
@Controller('projects/:projectId/payroll')
export class ProjectPayrollController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // Tabla de semanas del proyecto (wireframe superior)
  @Get('summary')
  async summaryByProject(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query('asOfDate') asOfDate?: string,
  ) {
    const rows = await this.attendanceService.getWeeklyPayrollSummaryByProject(
      projectId,
      asOfDate ? new Date(asOfDate) : new Date(),
    );

    return rows.map((r) => ({
      weekId: r.weekId,
      label: formatWeekLabel(r.startDate, r.endDate),
      laborer: r.laborerTotal,
      technician: r.technicianTotal,
      total: r.grandTotal,
    }));
  }

  // Detalle de una semana del proyecto (wireframe “Click en See Button” dentro de proyecto)
  @Get('weeks/:weekId')
  async detailByProjectWeek(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('weekId', ParseIntPipe) weekId: number,
    @Query('asOfDate') asOfDate?: string,
    @Query('formatCurrency') formatCurrencyFlag?: string,
  ) {
    const money = String(formatCurrencyFlag) === 'true';
    const detail = await this.attendanceService.getWeeklyPayrollForProjectWeek({
      projectId,
      weekId,
      asOfDate: asOfDate ? new Date(asOfDate) : new Date(),
    });

    const week = await (this.attendanceService as any).prismaService.week.findUnique({
      where: { weekId },
      select: { startDate: true, endDate: true },
    });

    return {
      projectId,
      weekId,
      label: week ? formatWeekLabel(week.startDate, week.endDate) : `Semana #${weekId}`,
      totals: {
        laborer: detail.totals.laborer,
        technician: detail.totals.technician,
        total: detail.totals.total,
      },
      breakdown: detail.breakdown.map((b) => ({
        workerId: b.workerId,
        fullName: b.fullName,
        workerType: b.workerType,
        days: b.days,
        dailyWage: b.dailyWage,
        total: b.total,
        discounts: b.discounts,
        net: b.net,
      })),
    };
  }
}
