import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export class CreateServiceSaleDto {
  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsNotEmpty({ message: 'El ID de proyecto es obligatorio.' })
  projectId!: number;

  @ApiProperty({ example: 'Servicio de topografía' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre del servicio es obligatorio.' })
  serviceName!: string;

  @ApiProperty({ example: 5000.0, minimum: 0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'El monto debe ser mayor o igual a 0' })
  @IsNotEmpty({ message: 'El monto es obligatorio' })
  amount!: number;

  @ApiPropertyOptional({ example: 'No description provided' })
  @IsOptional()
  @IsString()
  description?: string;
}
