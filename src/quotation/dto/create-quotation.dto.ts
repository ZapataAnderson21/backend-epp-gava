import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CreateQuotationItemDto } from './create-quotation-item.dto';
import { QuotationType } from '../enum';

export class CreateQuotationDto {
  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsNotEmpty({ message: 'El ID del cliente es obligatorio.' })
  clientId!: number;

  @ApiProperty({
    enum: QuotationType,
    enumName: 'QuotationType',
    example: QuotationType.Works,
  })
  @IsEnum(QuotationType, {
    message: `Tipo de cotización inválido. Los valores permitidos son: ${Object.values(QuotationType).join(', ')}.`,
  })
  type!: QuotationType;

  @ApiProperty({ example: 'Instalación de canaletas para el edificio XYZ.' })
  @IsString()
  @IsNotEmpty({ message: 'La descripción de la cotización es obligatoria.' })
  serviceDescription!: string;

  @ApiPropertyOptional({ example: 'Pago a la entrega de canaletas pintadas.' })
  @IsOptional()
  @IsString()
  commercialTerms?: string;

  @ApiProperty({ type: [CreateQuotationItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuotationItemDto)
  items!: CreateQuotationItemDto[];
}
