import { ApiProperty } from '@nestjs/swagger';
import { RequestType } from '../entities/request.entity';

export class CreateRequestDto {
  @ApiProperty()
  description: string;

  @ApiProperty()
  project_id: number;

  @ApiProperty()
  user_id: number;

  @ApiProperty({ enum: RequestType })
  type: RequestType;

  @ApiProperty()
  delivery_due_date: Date;
}
