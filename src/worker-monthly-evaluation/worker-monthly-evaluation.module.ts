import { Module } from '@nestjs/common';
import { WorkerMonthlyEvaluationController } from './worker-monthly-evaluation.controller';
import { WorkerMonthlyEvaluationService } from './worker-monthly-evaluation.service';

@Module({
  controllers: [WorkerMonthlyEvaluationController],
  providers: [WorkerMonthlyEvaluationService],
})
export class WorkerMonthlyEvaluationModule {}
