import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsInt, IsNotEmpty, IsString, Matches, } from "class-validator";

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: "\nEl nombre es requerido." })
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: "\nEl apellido es requerido." })
  last_name: string;

  @ApiProperty()
  @IsEmail({}, { message: "\nEl correo electrónico no es válido." })
  @IsNotEmpty({ message: "\nEl email es requerido." })
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: "\nLa contraseña es requerida." })
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).+$/, {
    message:
      "\nLa contraseña debe contener al menos una mayúscula, un número y un caracter especial.",
  })
  password?: string;

  @ApiProperty()
  @IsInt()
  @IsNotEmpty({ message: "\nEl tipo de usuario (rol) es requerido." })
  user_type_id: number;
}
