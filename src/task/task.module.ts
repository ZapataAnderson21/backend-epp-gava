import { Module } from '@nestjs/common';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { TaskPermissionGuard } from './guards';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [PrismaModule, NotificationModule],
  controllers: [TaskController],
  providers: [TaskService, TaskPermissionGuard],
  exports: [TaskService],
})
export class TaskModule {}
