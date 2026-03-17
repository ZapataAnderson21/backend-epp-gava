import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateQuotationItemDto {
  @ApiProperty({ example: 'Pintado de canaletas con pintura trafico color negro - amarillo' })
  @IsString()
  @IsNotEmpty({ message: 'La descripcion es obligatoria.' })
  description!: string;

  @ApiProperty({ example: 'UND' })
  @IsString()
  @IsNotEmpty({ message: 'La unidad es obligatoria.' })
  unit!: string;

  @ApiProperty({ example: 23, minimum: 0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001, { message: 'La cantidad debe ser mayor a 0.' })
  quantity!: number;

  @ApiProperty({ example: 15.0, minimum: 0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'El precio unitario debe ser mayor o igual a 0.' })
  unitPrice!: number;

  @ApiPropertyOptional({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  orderNumber?: number;
}
