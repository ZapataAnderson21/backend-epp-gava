import { Injectable } from '@nestjs/common';
import { CreateWeekDto } from './dto/create-week.dto';
import { UpdateWeekDto } from './dto/update-week.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class WeekService {

  constructor(private readonly prismaService: PrismaService) {}

  async createWeekForToday() {
    const startDate = new Date();      // el cron se ejecuta lunes 00:00
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6); // hasta domingo
    endDate.setHours(23, 59, 59, 999);

    return this.prismaService.week.create({
      data: {
        startDate,
        endDate,
      },
    });
  }
}
