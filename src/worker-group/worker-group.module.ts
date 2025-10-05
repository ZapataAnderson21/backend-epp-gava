import { Module } from '@nestjs/common';
import { WorkerGroupService } from './worker-group.service';
import { WorkerGroupController } from './worker-group.controller';

@Module({
  controllers: [WorkerGroupController],
  providers: [WorkerGroupService],
})
export class WorkerGroupModule {}
