import { Module } from '@nestjs/common';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { TaskModule } from 'src/task/task.module';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [PrismaModule, TaskModule, NotificationModule],
  controllers: [ProjectController],
  providers: [ProjectService],
})
export class ProjectModule {}
