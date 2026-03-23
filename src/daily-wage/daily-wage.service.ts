import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpsertWeekDailyWageDto } from './dto/upsert-week-daily-wage.dto';

@Injectable()
export class DailyWageService {
  private readonly logger = new Logger('DailyWageService');

  constructor(private readonly prismaService: PrismaService) {}

  /**
   * weekId + workerId:
   * - si existe registro para esa semana (validFromDate), hace UPDATE del amount
   * - si no existe, crea uno nuevo con esa semana
   */
  async upsertForWeek(weekId: number, dto: UpsertWeekDailyWageDto) {
    this.logger.log(
      `Upserting daily wages for weekId=${weekId}, items=${JSON.stringify(dto.items)}`,
    );

    // Obtener la fecha de inicio de la semana
    const week = await this.prismaService.week.findUnique({
      where: { weekId },
      select: { startDate: true },
    });

    if (!week) {
      throw new Error(`Week with id ${weekId} not found`);
    }

    const validFromDate = new Date(week.startDate);
    validFromDate.setHours(0, 0, 0, 0);

    const tx = dto.items.map((item) =>
      this.prismaService.dailyWage.upsert({
        where: {
          // generado por @@unique([workerId, validFromDate])
          workerId_validFromDate: {
            workerId: item.workerId,
            validFromDate: validFromDate,
          },
        },
        create: {
          workerId: item.workerId,
          validFromDate: validFromDate,
          amount: item.amount,
        },
        update: {
          amount: item.amount,
        },
      }),
    );

    const result = await this.prismaService.$transaction(tx);

    this.logger.log(result);

    return {
      message: 'Pagos diarios actualizados.',
      statusCode: HttpStatus.OK,
      data: result,
    };
  }
}
