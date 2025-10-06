import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsNotEmpty, IsOptional, IsPositive, IsString } from "class-validator";

export class CreateResourceDto {
  @ApiProperty({ example: 'Guantes de nitrilo' }) 
  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido.' })
  name!: string;

  @ApiPropertyOptional({ example: 'Talla M' }) 
  @IsOptional() 
  @IsString() 
  description?: string;

  @ApiProperty({ example: 1 }) 
  @Type(() => Number) 
  @IsInt()
  @IsPositive()
  @IsNotEmpty({ message: 'La categoría es obligatoria.' })
  categoryResourceId!: number;

  @ApiProperty({ example: 'par' }) 
  @IsString()
  @IsNotEmpty({ message: 'La unidad de medida es obligatoria.' })
  unit!: string;
}