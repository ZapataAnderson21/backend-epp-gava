import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Currency } from '../enum/currency.enum';
import { SupplierDocumentType } from '../enum/document-type.enum';
import { Transform } from 'class-transformer';

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

export class CreateSupplierDto {
  @ApiProperty({ example: 'Proveedor SAC' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'María Flores' })
  @IsString()
  contactName!: string;

  @ApiPropertyOptional({ example: '987654321' })
  @Length(9, 9, { message: 'El teléfono debe tener exactamente 9 caracteres.' })
  @IsString()
  @IsNotEmpty({ message: 'El teléfono es obligatorio.' })
  phone!: string;

  @ApiPropertyOptional({ example: 'ventas@proveedor.com' })
  @Transform(({ value }) => toNullIfEmpty(value))
  @IsOptional()
  @IsEmail({}, { message: 'El email no tiene formato válido.' })
  email?: string;

  @ApiPropertyOptional({ example: 'Av. Siempre Viva 123' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({
    enum: SupplierDocumentType,
    enumName: 'SupplierDocumentType',
    example: SupplierDocumentType.ruc,
  })
  @IsOptional()
  @IsEnum(SupplierDocumentType)
  documentType?: SupplierDocumentType;

  @ApiProperty({ example: '20123456789' })
  @Transform(({ value }) => toUndefIfEmpty(value))
  @ValidateIf(
    (o) =>
      (o.documentType ?? SupplierDocumentType.ruc) === SupplierDocumentType.ruc,
  )
  @IsString()
  @IsNotEmpty({ message: 'El RUC es obligatorio.' })
  @Length(11, 11, { message: 'El RUC debe tener exactamente 11 dígitos.' })
  @IsNumberString(
    { no_symbols: true },
    { message: 'El RUC debe contener solo dígitos.' },
  )
  ruc?: string;

  @ApiPropertyOptional({ example: '12345678' })
  @Transform(({ value }) => toUndefIfEmpty(value))
  @ValidateIf(
    (o) =>
      (o.documentType ?? SupplierDocumentType.ruc) === SupplierDocumentType.dni,
  )
  @IsString()
  @IsNotEmpty({ message: 'El DNI es obligatorio.' })
  @Length(8, 8, { message: 'El DNI debe tener exactamente 8 dígitos.' })
  @IsNumberString(
    { no_symbols: true },
    { message: 'El DNI debe contener solo dígitos.' },
  )
  dni?: string;

  @ApiProperty({ example: '123-456-7890' })
  @IsString()
  @MinLength(13, {
    message: 'El número de cuenta debe tener al menos 13 dígitos.',
  })
  @MaxLength(20, {
    message: 'El número de cuenta debe tener como máximo 20 dígitos.',
  })
  @IsNumberString(
    { no_symbols: true },
    { message: 'El número de cuenta debe contener solo dígitos.' },
  )
  accountNumber!: string;

  @ApiProperty({ example: 'BCP' })
  @IsString()
  bank!: string;

  @ApiPropertyOptional({
    enum: Currency,
    enumName: 'Currency',
    example: Currency.PEN,
  })
  @IsOptional()
  @IsEnum(Currency)
  @IsNotEmpty({ message: 'La moneda de la cuenta bancaria es obligatoria.' })
  currency!: Currency;
}
