import { ApiProperty } from '@nestjs/swagger';
import { RequestType } from '../entities/request.entity';
import { IsDate, IsEnum, IsString } from 'class-validator';

export class CreateRequestDto {
  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty()
  @IsString()
  project_id: number;

  @ApiProperty()
  @IsString()
  user_id: number;

  @ApiProperty({ enum: RequestType })
  @IsEnum(RequestType)
  type: RequestType;

  @ApiProperty()
  @IsDate()
  delivery_due_date: Date;
}
