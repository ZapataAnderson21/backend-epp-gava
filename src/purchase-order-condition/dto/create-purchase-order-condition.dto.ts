import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { PurchaseOrderConditionType } from '../enum/purchase-order-condition-type.enum';

const normalizeSpaces = (value: unknown) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;

export class CreatePurchaseOrderConditionDto {
  @ApiProperty({
    enum: PurchaseOrderConditionType,
    enumName: 'PurchaseOrderConditionType',
    example: PurchaseOrderConditionType.Commercial,
  })
  @IsEnum(PurchaseOrderConditionType)
  type!: PurchaseOrderConditionType;

  @ApiProperty({
    example: 'Los precios incluyen transporte hasta el proyecto.',
    maxLength: 500,
  })
  @Transform(({ value }) => normalizeSpaces(value))
  @IsString()
  @IsNotEmpty({ message: 'La condición no puede estar vacía.' })
  @MaxLength(500, { message: 'La condición no puede superar 500 caracteres.' })
  content!: string;
}
