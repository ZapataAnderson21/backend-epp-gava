import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
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
