import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RegisterWorkerAssignmentLineDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  workerId!: number;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @ApiPropertyOptional({ example: 'Entrega inicial en obra.' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RegisterWorkerAssignmentsDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  performedByUserId!: number;

  @ApiProperty({ type: [RegisterWorkerAssignmentLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RegisterWorkerAssignmentLineDto)
  assignments!: RegisterWorkerAssignmentLineDto[];
}
