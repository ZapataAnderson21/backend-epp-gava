import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CreateQuotationItemDto } from './create-quotation-item.dto';

export class CreateQuotationDto {
  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsNotEmpty({ message: 'El ID del cliente es obligatorio.' })
  clientId!: number;

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
