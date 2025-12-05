import { Module } from '@nestjs/common';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { TaskModule } from 'src/task/task.module';

@Module({
  imports: [PrismaModule, TaskModule],
  controllers: [ProjectController],
  providers: [ProjectService],
})
export class ProjectModule {}
