import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CreateUserTypeDto {
  @ApiProperty({ example: 'Admin' })
  @IsString()
  @Length(2, 80)
  @IsNotEmpty({ message: 'El nombre del tipo de usuario es requerido.' })
  name!: string;
}
