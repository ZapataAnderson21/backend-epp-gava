import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ElementRequestWorkerPlanController } from './element_request_worker_plan.controller';
import { ElementRequestWorkerPlanService } from './element_request_worker_plan.service';

@Module({
  controllers: [ElementRequestWorkerPlanController],
  providers: [ElementRequestWorkerPlanService, PrismaService],
})
export class ElementRequestWorkerPlanModule {}
