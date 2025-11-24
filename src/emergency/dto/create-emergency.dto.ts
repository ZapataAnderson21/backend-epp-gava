import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString } from "class-validator";
import { EmergencyStatus } from '../enum/emergency-status.enum';
import { Type } from "class-transformer";

export class CreateEmergencyDto {
  @ApiProperty({ example: 'evidencia.jpg' }) 
  @IsString()
  @IsNotEmpty({ message: 'La imagen de evidencia es obligatoria.' })
  image!: string;

  @ApiProperty({ example: 'Destornillador roto.' }) 
  @IsString() 
  @IsNotEmpty({ message: 'El título es obligatorio. ' })
  title!: string;

  @ApiProperty({ example: 'Descripción detallada...' }) 
  @IsString() 
  @IsNotEmpty({ message: 'La descripción es obligatoria. ' })
  description!: string;

  @ApiProperty({ example: 1 }) 
  @Type(() => Number) 
  @IsInt() 
  @IsPositive()
  @IsNotEmpty({ message: 'El ID de usuario es obligatorio. ' })
  userId!: number;

  @ApiProperty({ example: 10 }) 
  @Type(() => Number) 
  @IsInt() 
  @IsPositive()
  @IsNotEmpty({ message: 'El ID de proyecto es obligatorio. ' })
  projectId!: number;

  @ApiPropertyOptional({ enum: EmergencyStatus, enumName: 'EmergencyStatus', example: EmergencyStatus.Pending })
  @IsOptional() 
  @IsEnum(EmergencyStatus) 
  status?: EmergencyStatus;
}
