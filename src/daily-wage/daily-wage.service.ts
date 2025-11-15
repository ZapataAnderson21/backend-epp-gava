import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpsertWeekDailyWageDto } from './dto/upsert-week-daily-wage.dto';

@Injectable()
export class DailyWageService {

  private readonly logger = new Logger('DailyWageService');

  constructor(private readonly prismaService: PrismaService) {}

  /**
   * weekId + workerId:
   * - si existe registro para esa semana, hace UPDATE del amount
   * - si no existe, crea uno nuevo con esa semana
   */
  async upsertForWeek(
    weekId: number,
    dto: UpsertWeekDailyWageDto,
  ) {
    this.logger.log(
      `Upserting daily wages for weekId=${weekId}, items=${JSON.stringify(dto.items)}`,
    );

    const tx = dto.items.map((item) =>
      this.prismaService.dailyWage.upsert({
        where: {
          // generado por @@unique([workerId, validFromWeekId])
          workerId_validFromWeekId: {
            workerId: item.workerId,
            validFromWeekId: weekId,
          },
        },
        create: {
          workerId: item.workerId,
          validFromWeekId: weekId,
          amount: item.amount,
        },
        update: {
          amount: item.amount,
        },
      }),
    );

    const result = await this.prismaService.$transaction(tx);

    return {
      message: 'Daily wages actualizados correctamente.',
      statusCode: HttpStatus.OK,
      data: result,
    };
  }
}
