import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsNotEmpty, IsNumber, IsPositive, Min } from "class-validator";

export class CreateResourcePurchaseOrderDto {
  @ApiProperty({ example: 1 }) 
  @Type(() => Number) 
  @IsInt()
  @IsPositive()
  @IsNotEmpty({ message: 'El ID de la orden de compra es obligatorio.' })
  purchaseOrderId!: number;

  @ApiProperty({ example: 2 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsNotEmpty({ message: 'El ID del recurso es obligatorio.' })
  resourceId!: number;

  @ApiProperty({ example: 10.5, minimum: 0 }) 
  @Type(() => Number) 
  @IsNumber({ maxDecimalPlaces: 2 }) 
  @Min(0, { message: 'La cantidad debe ser al menos 0.' })
  @IsNotEmpty({ message: 'La cantidad es obligatoria.' })
  quantity!: number;

  @ApiProperty({ example: 15.75, minimum: 0 }) 
  @Type(() => Number) 
  @IsNumber({ maxDecimalPlaces: 2 }) 
  @Min(0, { message: 'El precio de venta debe ser al menos 0.' })
  @IsNotEmpty({ message: 'El precio de venta es obligatorio.' })
  unitSalesPrice!: number;

  @ApiProperty({ example: 12.30, minimum: 0 }) 
  @Type(() => Number) 
  @IsNumber({ maxDecimalPlaces: 2 }) 
  @Min(0, { message: 'El precio de compra debe ser al menos 0.' })
  @IsNotEmpty({ message: 'El precio de compra es obligatorio.' })
  unitPurchasePrice!: number;
}