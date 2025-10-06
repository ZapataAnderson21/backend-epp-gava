import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsNotEmpty, IsOptional, IsPositive, IsString } from "class-validator";

export class CreateWorkerGroupDto {
  @ApiProperty({ example: 'Operarios' }) 
  @IsString()
  @IsNotEmpty({ message: 'El nombre del grupo es requerido.' })
  name!: string;

  @ApiPropertyOptional({ example: 'Subgrupo de campo' }) 
  @IsOptional() 
  @IsString() 
  description?: string;

  @ApiPropertyOptional({ example: 1 }) 
  @IsOptional() 
  @Type(() => Number) 
  @IsInt() 
  @IsPositive()
  parentGroupId?: number;
}