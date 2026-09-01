import { IsInt, Min, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class TaskOrderUpdate {
  @IsInt()
  taskId!: number;

  @IsInt()
  @Min(0)
  displayOrder!: number;
}

export class ReorderTaskDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskOrderUpdate)
  updates!: TaskOrderUpdate[];
}
