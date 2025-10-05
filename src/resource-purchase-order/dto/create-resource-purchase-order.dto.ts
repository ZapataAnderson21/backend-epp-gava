import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsNumber, Min } from "class-validator";

export class CreateResourcePurchaseOrderDto {
  @ApiProperty({ example: 1 }) 
  @Type(() => Number) 
  @IsInt() 
  purchaseOrderId!: number;

  @ApiProperty({ example: 2 }) 
  @Type(() => Number) 
  @IsInt() 
  resourceId!: number;

  @ApiProperty({ example: 10.5, minimum: 0 }) 
  @Type(() => Number) 
  @IsNumber({ maxDecimalPlaces: 2 }) 
  @Min(0, { message: 'La cantidad debe ser al menos 0.' }) 
  quantity!: number;

  @ApiProperty({ example: 15.75, minimum: 0 }) 
  @Type(() => Number) 
  @IsNumber({ maxDecimalPlaces: 2 }) 
  @Min(0, { message: 'El precio de venta debe ser al menos 0.' })
  unitSalesPrice!: number;

  @ApiProperty({ example: 12.30, minimum: 0 }) 
  @Type(() => Number) 
  @IsNumber({ maxDecimalPlaces: 2 }) 
  @Min(0, { message: 'El precio de compra debe ser al menos 0.' }) 
  unitPurchasePrice!: number;
}