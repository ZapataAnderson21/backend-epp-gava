import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, MinLength, Matches, IsString, IsNotEmpty } from 'class-validator';

export class UpdateUserDto extends PartialType(CreateUserDto) {
	@ApiPropertyOptional({ minLength: 8, example: 'Secreta#123' })
	@IsOptional()
	@IsString()
	@MinLength(8, { message: "\nLa contraseña debe tener al menos 8 caracteres." })
	@Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).+$/, {
		message:
			"\nLa contraseña debe contener al menos una mayúscula, un número y un caracter especial.",
	})
	password?: string;
}
