import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateUserTypeDto {
  @ApiProperty({ example: 'Admin' })
  @IsString()
  @IsNotEmpty({ message: "El nombre del tipo de usuario es requerido." })
  name!: string;
}
