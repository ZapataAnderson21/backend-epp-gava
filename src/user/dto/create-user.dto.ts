import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsInt, IsNotEmpty, IsString, Matches, } from "class-validator";

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  last_name: string;

  @ApiProperty()
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).+$/, {
    message:
      "La contraseña debe contener al menos una mayúscula, un número y un caracter especial.",
  })
  password?: string;

  @ApiProperty()
  @IsInt()
  @IsNotEmpty()
  user_type_id: number;
}
