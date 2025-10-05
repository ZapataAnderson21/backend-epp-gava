import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsEnum, IsNumberString, IsOptional, IsString, Length, MaxLength, MinLength } from "class-validator";
import { Currency } from "../enum/currency.enum";

export class CreateSupplierDto {
  @ApiProperty({ example: 'Proveedor SAC' }) 
  @IsString() 
  name!: string;

  @ApiProperty({ example: 'María Flores' }) 
  @IsString() 
  contactName!: string;

  @ApiPropertyOptional({ example: '987654321' })
  @Length(9, 9, { message: "El teléfono debe tener exactamente 9 caracteres." })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'ventas@proveedor.com' }) 
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: 'Av. Siempre Viva 123' }) 
  @IsString() 
  @IsOptional()
  address?: string;

  @ApiProperty({ example: '20123456789' }) 
  @IsString() 
  @Length(11, 11, { message: 'El RUC debe tener exactamente 11 dígitos.' })
  @IsNumberString({ no_symbols: true }, { message: 'El RUC debe contener solo dígitos.' })
  ruc!: string;

  @ApiProperty({ example: '123-456-7890' }) 
  @IsString()
  @MinLength(13)
  @MaxLength(20)
  @IsNumberString({ no_symbols: true }, { message: 'El número de cuenta debe contener solo dígitos.' })
  accountNumber!: string;

  @ApiProperty({ example: 'BCP' }) 
  @IsString() 
  bank!: string;

  @ApiPropertyOptional({ enum: Currency, enumName: 'Currency', example: Currency.PEN })
  @IsOptional() 
  @IsEnum(Currency) 
  currency?: Currency;
}