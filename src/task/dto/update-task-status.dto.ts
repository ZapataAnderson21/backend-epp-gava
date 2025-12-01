import { IsEnum } from 'class-validator';
import { TaskStatus } from './create-task.dto';

export class UpdateTaskStatusDto {
  @IsEnum(TaskStatus)
  status: TaskStatus;
}
