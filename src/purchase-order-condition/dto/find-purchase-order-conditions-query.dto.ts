import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PurchaseOrderConditionType } from '../enum/purchase-order-condition-type.enum';

export class FindPurchaseOrderConditionsQueryDto {
  @ApiProperty({
    enum: PurchaseOrderConditionType,
    enumName: 'PurchaseOrderConditionType',
  })
  @IsEnum(PurchaseOrderConditionType)
  type!: PurchaseOrderConditionType;

  @ApiPropertyOptional({ maxLength: 200 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : undefined,
  )
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
