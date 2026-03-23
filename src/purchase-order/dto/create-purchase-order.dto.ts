import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { PaymentMethod, PurchaseOrderStatus, PurchaseOrderType } from '../enum';
import { Type } from 'class-transformer';

export class CreatePurchaseOrderDto {
  @ApiProperty({ example: 'OC-000123' })
  @IsString()
  @IsNotEmpty({ message: 'El código es requerido.' })
  code!: string;

  @ApiProperty({ example: 'Almacén Central' })
  @IsString()
  @IsNotEmpty({ message: 'La ubicación de entrega es requerida.' })
  deliveryLocation!: string;

  @ApiProperty({ example: 'Proyecto A' })
  @IsString()
  @IsNotEmpty({ message: 'El destino es requerido.' })
  destination!: string;

  @ApiProperty({ example: '30 días' })
  @IsString()
  @IsNotEmpty({ message: 'Las condiciones de pago son requeridas.' })
  paymentConditions!: string;

  @ApiPropertyOptional({ example: 'Condiciones generales...' })
  @IsOptional()
  @IsString()
  generalConditions?: string;

  @ApiPropertyOptional({ example: 'Condiciones de calidad...' })
  @IsOptional()
  @IsString()
  qualityConditions?: string;

  @ApiProperty({
    enum: PaymentMethod,
    enumName: 'PaymentMethod',
    example: PaymentMethod.Transfer,
  })
  @IsEnum(PaymentMethod)
  @IsNotEmpty({ message: 'El método de pago es requerido.' })
  paymentMethod!: PaymentMethod;

  @ApiProperty({ example: 1000.0, minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'El monto de venta debe ser al menos 0.' })
  saleAmount!: number;

  @ApiProperty({ example: 800.0, minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'El monto de compra debe ser al menos 0.' })
  purchaseAmount!: number;

  @ApiPropertyOptional({
    enum: PurchaseOrderStatus,
    enumName: 'PurchaseOrderStatus',
    example: PurchaseOrderStatus.Pending,
  })
  @IsOptional()
  @IsEnum(PurchaseOrderStatus)
  status?: PurchaseOrderStatus;

  @ApiProperty({ example: 'Juan Pérez' })
  @IsString()
  @IsNotEmpty({ message: 'El responsable es requerido.' })
  carePerson!: string;

  @ApiProperty({ example: '12345678' })
  @IsString()
  @Length(8, 8, { message: 'El DNI debe tener exactamente 8 caracteres.' })
  dniCarePerson!: string;

  @ApiPropertyOptional({ example: 'Observaciones...' })
  @IsOptional()
  @IsString()
  observations?: string;

  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsNotEmpty({ message: 'El ID de proyecto es obligatorio. ' })
  projectId!: number;

  @ApiProperty({ example: 4 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsNotEmpty({ message: 'El ID de proveedor es obligatorio. ' })
  supplierId!: number;

  @ApiPropertyOptional({ example: 'Cotización 123' })
  @IsString()
  @IsOptional()
  quotation?: string;

  @ApiProperty({
    enum: PurchaseOrderType,
    enumName: 'PurchaseOrderType',
    example: PurchaseOrderType.Materials,
  })
  @IsEnum(PurchaseOrderType)
  @IsNotEmpty({ message: 'El tipo de orden de compra es obligatorio.' })
  purchaseOrderType!: PurchaseOrderType;
}
