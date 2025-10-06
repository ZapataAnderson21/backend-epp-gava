import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsNotEmpty, IsOptional, IsString, Length, MinLength } from "class-validator";

export class CreateWorkerDto {
  @ApiProperty({ example: 'Luis Ramos' }) 
  @IsString() 
  @IsNotEmpty({ message: 'El nombre completo es requerido.' })
  fullName!: string;

  @ApiProperty({ example: '12345678' }) 
  @Length(8, 8, { message: "El DNI debe tener exactamente 8 caracteres." })
  @IsString()
  @IsNotEmpty({ message: 'El DNI es requerido.' })
  dni!: string;

  @ApiPropertyOptional({ example: '987654321' })
  @Length(9, 9, { message: "El teléfono debe tener exactamente 9 caracteres." })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Av. Siempre Viva 123' }) 
  @IsOptional() 
  @IsString() 
  address?: string;

  @ApiProperty({ example: 3 }) 
  @Type(() => Number) 
  @IsInt() 
  workerGroupId!: number;
}