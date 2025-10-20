import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Length, MinLength } from "class-validator";

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
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'luis.ramos@example.com' })
  @IsOptional()
  @IsString()
  personalEmail?: string;

  @ApiPropertyOptional({ example: 'Av. Siempre Viva 123' }) 
  @IsOptional() 
  @IsString() 
  address?: string;

  @ApiPropertyOptional({ example: '1990-01-01' })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value)) // evita "" -> Invalid Date
  @IsDateString({}, { message: 'birthDate debe tener formato ISO: YYYY-MM-DD' })
  birthDate?: string;

  @ApiProperty({ example: 3 }) 
  @Type(() => Number) 
  @IsInt() 
  workerGroupId!: number;
}