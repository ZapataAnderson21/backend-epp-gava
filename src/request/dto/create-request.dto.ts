import { ApiProperty } from '@nestjs/swagger';
import { RequestType } from '../entities/request.entity';
import { IsDate, IsDateString, IsEnum, IsNumber, IsString } from 'class-validator';

export class CreateRequestDto {
  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty()
  @IsNumber()
  project_id: number;

  @ApiProperty()
  @IsNumber()
  user_id: number;

  @ApiProperty({ enum: RequestType })
  @IsEnum(RequestType)
  type: RequestType;

  @ApiProperty()
  @IsDateString()
  delivery_due_date: Date;
}
