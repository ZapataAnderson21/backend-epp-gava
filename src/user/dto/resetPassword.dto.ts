import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, Matches, MinLength } from "class-validator";

export class ResetPasswordDto {

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'El token de acceso es requerido.' })
  accessToken!: string;

  @ApiProperty({ minLength: 8, example: 'Secreta#123' })
  @IsString()
  @IsNotEmpty({ message: "La contraseña es requerida." })
  @MinLength(8, { message: "La contraseña debe tener al menos 8 caracteres." })
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).+$/, {
    message:
      "La contraseña debe contener al menos una mayúscula, un número y un caracter especial.",
  })
  password!: string;
}