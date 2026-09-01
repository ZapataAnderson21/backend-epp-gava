import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
} from 'class-validator';
import { Currency } from 'src/generated/prisma';

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
  @IsPositive({ message: 'El monto debe ser mayor que 0' })
  @IsNotEmpty({ message: 'El monto es obligatorio' })
  amount!: number;

  @ApiProperty({ enum: Currency, example: Currency.PEN })
  @IsEnum(Currency, { message: 'La moneda debe ser PEN, USD o EUR.' })
  currency!: Currency;

  @ApiProperty({ example: 'Pago correspondiente al primer avance.' })
  @IsString()
  @IsNotEmpty({ message: 'La descripción es obligatoria.' })
  description!: string;
}
