import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsNotEmpty, IsOptional, IsPositive, IsString } from "class-validator";

export class CreateCategoryResourceDto {
  @ApiProperty({ example: 'EPP' }) 
  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido.' })
  name!: string;

  @ApiPropertyOptional({ example: 'Equipo de Protección Personal' }) 
  @IsOptional() 
  @IsString() 
  description?: string;

  @ApiPropertyOptional({ example: 1 }) 
  @IsOptional() 
  @Type(() => Number) 
  @IsInt()
  @IsPositive()
  parentCategoryId?: number;
}