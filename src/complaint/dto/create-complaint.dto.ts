import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateComplaintDto {
  @ApiProperty({
    example: 'Demora en la entrega de equipos de protección personal.',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty({ message: 'El reclamo es obligatorio.' })
  @MinLength(5, { message: 'El reclamo debe tener al menos 5 caracteres.' })
  @MaxLength(200, { message: 'El reclamo no puede superar los 200 caracteres.' })
  claim!: string;

  @ApiProperty({
    example: 'Los equipos debían entregarse el lunes y aún no han llegado.',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty({ message: 'La descripción es obligatoria.' })
  @MinLength(10, {
    message: 'La descripción debe tener al menos 10 caracteres.',
  })
  @MaxLength(2000, {
    message: 'La descripción no puede superar los 2000 caracteres.',
  })
  description!: string;
}
