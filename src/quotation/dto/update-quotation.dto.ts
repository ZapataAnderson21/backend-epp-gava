import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateQuotationDto } from './create-quotation.dto';
import { QuotationStatus } from '../enum';

export class UpdateQuotationDto extends PartialType(CreateQuotationDto) {
  @ApiPropertyOptional({
    enum: QuotationStatus,
    enumName: 'QuotationStatus',
    example: QuotationStatus.Draft,
  })
  @IsOptional()
  @IsEnum(QuotationStatus)
  status?: QuotationStatus;
}
