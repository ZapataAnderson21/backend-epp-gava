import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';
import { PettyCashType } from '../enum';

export class CreatePettyCashDto {
  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsNotEmpty({ message: 'El ID de proyecto es obligatorio. ' })
  projectId!: number;

  @ApiProperty({ example: 120.0, minimum: 0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'El monto debe ser mayor o igual a 0' })
  @IsNotEmpty({ message: 'El monto es obligatorio' })
  amount!: number;

  @ApiPropertyOptional({ example: 'No description provided' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '2025-10-20T00:00:00.000Z' })
  @IsDateString()
  expenseDate!: string;

  @ApiProperty({
    enum: PettyCashType,
    enumName: 'PettyCashType',
    example: PettyCashType.Supplies,
  })
  @IsEnum(PettyCashType)
  @IsNotEmpty({ message: 'El tipo de gasto es obligatorio' })
  expenseType!: PettyCashType;

  @ApiPropertyOptional({ example: 'INV-12345' })
  @IsOptional()
  @IsString()
  invoiceNumber?: string;
}
