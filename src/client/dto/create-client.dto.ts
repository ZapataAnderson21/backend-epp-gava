import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsNumberString, IsOptional, IsString, Length } from 'class-validator';

const toNullIfEmpty = (v: any) => {
  if (v === undefined || v === null) return null;
  const t = String(v).trim();
  return t === '' ? null : t;
};

export class CreateClientDto {
  @ApiProperty({ example: 'Grupo JAAC S.A.C' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  name!: string;

  @ApiProperty({ example: 'Victor Valdiviezo' })
  @IsString()
  @IsNotEmpty({ message: 'El contacto es obligatorio.' })
  contactName!: string;

  @ApiPropertyOptional({ example: '987654321' })
  @Transform(({ value }) => toNullIfEmpty(value))
  @IsOptional()
  @Length(9, 9, { message: 'El teléfono debe tener exactamente 9 dígitos.' })
  @IsNumberString({ no_symbols: true }, { message: 'El teléfono debe contener solo dígitos.' })
  phone?: string;

  @ApiPropertyOptional({ example: 'contacto@cliente.com' })
  @Transform(({ value }) => toNullIfEmpty(value))
  @IsOptional()
  @IsEmail({}, { message: 'El email no tiene formato válido.' })
  email?: string;

  @ApiPropertyOptional({ example: 'Av. Siempre Viva 123' })
  @Transform(({ value }) => toNullIfEmpty(value))
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ example: '20526123655' })
  @IsString()
  @IsNotEmpty({ message: 'El RUC es obligatorio.' })
  @Length(11, 11, { message: 'El RUC debe tener exactamente 11 dígitos.' })
  @IsNumberString({ no_symbols: true }, { message: 'El RUC debe contener solo dígitos.' })
  ruc!: string;
}
