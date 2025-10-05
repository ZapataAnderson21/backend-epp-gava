import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsNotEmpty, IsOptional, IsString } from "class-validator";

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
  categoryResourceId!: number;

  @ApiProperty({ example: 'par' }) 
  @IsString() 
  unit!: string;
}