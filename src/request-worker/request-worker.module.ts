import { Module } from '@nestjs/common';
import { RequestWorkerService } from './request-worker.service';
import { RequestWorkerController } from './request-worker.controller';

@Module({
  controllers: [RequestWorkerController],
  providers: [RequestWorkerService],
})
export class RequestWorkerModule {}
