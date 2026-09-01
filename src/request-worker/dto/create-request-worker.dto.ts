import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class CreateRequestWorkerDto {
  @ApiProperty({ example: 100 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  requestId!: number;

  @ApiProperty({ example: '42' })
  @IsString()
  @IsOptional()
  shoeSize?: string;

  @ApiProperty({ example: 'M' })
  @IsString()
  @IsOptional()
  pantsSize?: string;

  @ApiProperty({ example: 'L' })
  @IsString()
  @IsOptional()
  shirtSize?: string;

  @ApiProperty({ example: 55 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  workerId!: number;
}
