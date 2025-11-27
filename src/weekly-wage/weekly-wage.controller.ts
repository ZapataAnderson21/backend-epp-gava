import { Controller, Get, Post, Body, Param, ParseIntPipe, Res, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { WeeklyWageService } from './weekly-wage.service';
import { SaveWeeklyWagesDto } from './dto/save-weekly-wages.dto';
import { ExcelService } from 'src/excel/excel.service';

@Controller('weekly-wage')
export class WeeklyWageController {
  constructor(
    private readonly weeklyWageService: WeeklyWageService,
    private readonly excelService: ExcelService,
  ) {}

  /**
   * GET /weekly-wage/weeks
   * Obtener todas las semanas con asistencias
   */
  @Get('weeks')
  findWeeksWithAttendances() {
    return this.weeklyWageService.findWeeksWithAttendances();
  }

  /**
   * GET /weekly-wage/week/:weekId
   * Obtener detalle de una semana específica
   */
  @Get('week/:weekId')
  findWeekDetail(@Param('weekId', ParseIntPipe) weekId: number) {
    return this.weeklyWageService.findWeekDetail(weekId);
  }

  /**
   * POST /weekly-wage/week/:weekId/save
   * Guardar/actualizar pagos semanales
   */
  @Post('week/:weekId/save')
  saveWeeklyWages(
    @Param('weekId', ParseIntPipe) weekId: number,
    @Body() dto: SaveWeeklyWagesDto,
  ) {
    return this.weeklyWageService.saveWeeklyWages(weekId, dto);
  }

  /**
   * GET /weekly-wage/week/:weekId/excel
   * Descargar Excel de la planilla semanal
   */
  @Get('week/:weekId/excel')
  async downloadExcel(
    @Param('weekId', ParseIntPipe) weekId: number,
    @Res() res: Response,
  ) {
    try {
      const buffer = await this.excelService.generateWeeklyPayrollExcel(weekId);

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=planilla_semana_${weekId}.xlsx`,
      );

      res.send(buffer);
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al generar el Excel',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
