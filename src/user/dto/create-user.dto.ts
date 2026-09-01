import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'Juan' })
  @IsString()
  @IsNotEmpty({ message: '\nEl nombre es requerido.' })
  name!: string;

  @ApiProperty({ example: 'Pérez' })
  @IsString()
  @IsNotEmpty({ message: '\nEl apellido es requerido.' })
  lastName!: string;

  @ApiProperty({ example: 'juan@example.com' })
  @IsEmail({}, { message: '\nEl correo electrónico no es válido.' })
  @IsNotEmpty({ message: '\nEl email es requerido.' })
  email!: string;

  @ApiProperty({ minLength: 8, example: 'Secreta#123' })
  @IsString()
  @IsNotEmpty({ message: '\nLa contraseña es requerida.' })
  @MinLength(8, {
    message: '\nLa contraseña debe tener al menos 8 caracteres.',
  })
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).+$/, {
    message:
      '\nLa contraseña debe contener al menos una mayúscula, un número y un caracter especial.',
  })
  password!: string;

  @ApiPropertyOptional({ example: '987654321' })
  @IsOptional()
  @IsString()
  @Length(9, 9, {
    message: '\nEl teléfono debe tener exactamente 9 caracteres.',
  })
  phone?: string;

  @ApiProperty()
  @IsInt()
  @IsPositive()
  @IsNotEmpty({ message: '\nEl tipo de usuario (rol) es requerido.' })
  userTypeId!: number;
}
