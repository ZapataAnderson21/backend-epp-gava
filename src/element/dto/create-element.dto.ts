import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class CreateElementDto {
  @ApiProperty()
  @IsString({ message: 'El nombre es requerido y debe ser un texto válido' })
  @IsNotEmpty({ message: 'El nombre no puede estar vacío. ' })
  name: string;

  @ApiProperty()
  @IsString({ message: 'El tipo es requerido y debe ser un texto válido' })
  @IsNotEmpty({ message: 'El tipo no puede estar vacío. ' })
  type: string;
  
  @ApiProperty()
  @IsString({ message: 'La descripción es requerida y debe ser un texto válido' })
  @IsNotEmpty({ message: 'La descripción no puede estar vacía. ' })
  description: string;
}
