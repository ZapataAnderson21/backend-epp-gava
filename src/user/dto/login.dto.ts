import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty()
  @IsEmail({}, { message: 'El correo electrónico no es válido.' })
  email!: string;

  @ApiProperty()
  @IsString()
  password!: string;
}
