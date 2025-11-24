import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { ElementType } from '../enum/element-type.enum';

export class CreateElementDto {
  @ApiProperty({ example: 'Casco de Seguridad' })
  @IsString({ message: 'El nombre es requerido y debe ser un texto válido' })
  @IsNotEmpty({ message: 'El nombre no puede estar vacío. ' })
  name!: string;

  @ApiPropertyOptional({ example: 'No description provided.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ElementType, enumName: 'ElementType', example: ElementType.Epp })
  @IsEnum(ElementType, { message: `Tipo de elemento inválido. Los valores permitidos son: ${Object.values(ElementType).join(', ')}.` })
  @IsNotEmpty({ message: 'El tipo de elemento es requerido.' })
  type!: ElementType;
}
