import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class WeekService {
  private readonly logger = new Logger('WeekService');

  constructor(private readonly prisma: PrismaService) {}

  private getMonday(date: Date) {
    const monday = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
    );
    const daysSinceMonday = (monday.getUTCDay() + 6) % 7;
    monday.setUTCDate(monday.getUTCDate() - daysSinceMonday);
    return monday;
  }

  private createWeekFromMonday(monday: Date) {
    const startDate = new Date(monday);
    const endDate = new Date(monday);
    endDate.setUTCDate(endDate.getUTCDate() + 6);
    endDate.setUTCHours(23, 59, 59, 999);
    return this.prisma.week.create({ data: { startDate, endDate } });
  }

  async ensureWeeksUpToCurrentWeek() {
    const currentMonday = this.getMonday(new Date());
    const firstWeek = await this.prisma.week.findFirst({
      orderBy: { startDate: 'asc' },
    });
    const startMonday = firstWeek
      ? new Date(firstWeek.startDate)
      : new Date(currentMonday);
    const existingWeeks = await this.prisma.week.findMany({
      select: { startDate: true },
    });
    const existingDates = new Set(
      existingWeeks.map((week) => week.startDate.toISOString().slice(0, 10)),
    );

    let createdCount = 0;
    for (
      const monday = new Date(startMonday);
      monday <= currentMonday;
      monday.setUTCDate(monday.getUTCDate() + 7)
    ) {
      if (!existingDates.has(monday.toISOString().slice(0, 10))) {
        await this.createWeekFromMonday(new Date(monday));
        createdCount += 1;
      }
    }

    this.logger.log(
      createdCount > 0
        ? `Se crearon ${createdCount} semana(s) faltante(s).`
        : 'Todas las semanas están actualizadas.',
    );
  }
}
