import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Length, IsEmail
} from "class-validator";

/** Helpers de transformación */
const trim = (v: any) => (typeof v === 'string' ? v.trim() : v);
const toNullIfEmpty = (v: any) => {
  if (v === undefined || v === null) return null;
  const t = String(v).trim();
  return t === '' ? null : t;
};
const toUndefIfEmpty = (v: any) => {
  if (v === undefined || v === null) return undefined;
  const t = String(v).trim();
  return t === '' ? undefined : t;
};

export class CreateWorkerDto {
  @ApiProperty({ example: 'Luis Ramos' })
  @Transform(({ value }) => trim(value))
  @IsString()
  @IsNotEmpty({ message: 'El nombre completo es requerido.' })
  fullName!: string;

  @ApiProperty({ example: '12345678' })
  @Transform(({ value }) => trim(value))
  @Length(8, 8, { message: "El DNI debe tener exactamente 8 caracteres." })
  @IsString()
  @IsNotEmpty({ message: 'El DNI es requerido.' })
  dni!: string;

  @ApiPropertyOptional({ example: '987654321' })
  @Transform(({ value }) => toNullIfEmpty(value))
  @IsOptional()
  @IsString()
  phone?: string | null;

  @ApiPropertyOptional({ example: 'luis.ramos@example.com' })
  @Transform(({ value }) => toNullIfEmpty(value))
  @IsOptional()
  @IsEmail({}, { message: 'personalEmail no tiene formato válido.' })
  personalEmail?: string | null;

  @ApiPropertyOptional({ example: 'Av. Siempre Viva 123' })
  @Transform(({ value }) => toUndefIfEmpty(value)) // deja pasar default() del schema si vacío
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: '1990-01-01' })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsDateString({}, { message: 'birthDate debe tener formato ISO: YYYY-MM-DD' })
  birthDate?: string;

  @ApiProperty({ example: 3 })
  @Type(() => Number)
  @IsInt()
  workerGroupId!: number;
}

/** Update DTO: todos opcionales y con mismas transforms */
export class UpdateWorkerDto {
  @ApiPropertyOptional({ example: 'Luis Ramos' })
  @Transform(({ value }) => toUndefIfEmpty(value))
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: '12345678' })
  @Transform(({ value }) => toUndefIfEmpty(value))
  @IsOptional()
  @Length(8, 8)
  @IsString()
  dni?: string;

  @ApiPropertyOptional({ example: '987654321' })
  @Transform(({ value }) => toNullIfEmpty(value))
  @IsOptional()
  @IsString()
  phone?: string | null;

  @ApiPropertyOptional({ example: 'luis.ramos@example.com' })
  @Transform(({ value }) => toNullIfEmpty(value))
  @IsOptional()
  @IsEmail()
  personalEmail?: string | null;

  @ApiPropertyOptional({ example: 'Av. Siempre Viva 123' })
  @Transform(({ value }) => toUndefIfEmpty(value))
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: '1990-01-01' })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({ example: 3 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  workerGroupId?: number;
}
