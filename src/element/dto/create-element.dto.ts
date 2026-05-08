import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsString,
  IsDateString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ElementControlType,
  ElementFamily,
  ElementType,
} from '../enum/element-type.enum';

export class CreateElementDto {
  @ApiProperty({ example: 'Casco de Seguridad' })
  @IsString({ message: 'El nombre es requerido y debe ser un texto valido.' })
  @IsNotEmpty({ message: 'El nombre no puede estar vacio.' })
  name!: string;

  @ApiPropertyOptional({ example: 'EPP-001' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  code?: string;

  @ApiPropertyOptional({
    enum: ElementFamily,
    enumName: 'ElementFamily',
    example: ElementFamily.Epp,
  })
  @IsOptional()
  @IsEnum(ElementFamily, {
    message: `La familia del elemento es invalida. Los valores permitidos son: ${Object.values(ElementFamily).join(', ')}.`,
  })
  family?: ElementFamily;

  @ApiPropertyOptional({ example: 'Proteccion de cabeza' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  categoryName?: string;

  @ApiPropertyOptional({ example: 'No description provided.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '3M' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  brand?: string;

  @ApiPropertyOptional({ example: 'ABC-123' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string;

  @ApiPropertyOptional({ example: 'L' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  size?: string;

  @ApiPropertyOptional({ example: 'SER-001' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  serialNumber?: string;

  @ApiPropertyOptional({ example: 'https://example.com/ficha.pdf' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  technicalSheetLink?: string;

  @ApiPropertyOptional({ example: 'operativo' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  operationalStatus?: string;

  @ApiPropertyOptional({ example: '2026-04-12' })
  @IsOptional()
  @IsDateString()
  manufactureDate?: string;

  @ApiPropertyOptional({ example: '2027-04-12' })
  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @ApiPropertyOptional({ example: 10 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'El stock minimo debe ser un numero valido. Puedes usar 0 si no deseas controlar un minimo.' },
  )
  @Min(0, { message: 'El stock minimo no puede ser negativo. Puedes dejarlo en 0.' })
  stockMinimum?: number;

  @ApiPropertyOptional({
    enum: ElementType,
    enumName: 'ElementType',
    example: ElementType.Epp,
  })
  @IsOptional()
  @IsEnum(ElementType, {
    message: `Tipo de elemento invalido. Los valores permitidos son: ${Object.values(ElementType).join(', ')}.`,
  })
  type?: ElementType;

  @ApiPropertyOptional({
    enum: ElementControlType,
    enumName: 'ElementControlType',
    example: ElementControlType.Returnable,
  })
  @IsOptional()
  @IsEnum(ElementControlType, {
    message: `Tipo de control invalido. Los valores permitidos son: ${Object.values(ElementControlType).join(', ')}.`,
  })
  controlType?: ElementControlType;
}
