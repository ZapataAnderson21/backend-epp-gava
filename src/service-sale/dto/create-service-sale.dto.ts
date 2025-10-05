import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateServiceSaleDto {
  @ApiProperty({ example: 10 }) 
  @Type(() => Number) 
  @IsInt() 
  projectId!: number;

  @ApiProperty({ example: 'Servicio de topografía' }) 
  @IsString()
  @IsNotEmpty()
  serviceName!: string;

  @ApiProperty({ example: 5000.00, minimum: 0 }) 
  @Type(() => Number) 
  @IsNumber({ maxDecimalPlaces: 2 }) 
  @Min(0, { message: 'El monto debe ser mayor o igual a 0' }) 
  amount!: number;

  @ApiPropertyOptional({ example: 'No description provided' })
  @IsOptional() 
  @IsString()
  description?: string;
}