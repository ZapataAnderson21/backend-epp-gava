import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsInt, IsOptional, IsString } from "class-validator";
import { EmergencyStatus } from "../enum/emergency-status.enum";
import { Type } from "class-transformer";

export class CreateEmergencyDto {
  @ApiProperty({ example: 'evidencia.jpg' }) 
  @IsString() 
  image!: string;

  @ApiProperty({ example: 'Destornillador roto.' }) 
  @IsString() 
  title!: string;

  @ApiProperty({ example: 'Descripción detallada...' }) 
  @IsString() 
  description!: string;

  @ApiPropertyOptional({ enum: EmergencyStatus, enumName: 'EmergencyStatus', example: EmergencyStatus.Pending })
  @IsOptional() 
  @IsEnum(EmergencyStatus) 
  status?: EmergencyStatus;
  
  @ApiProperty({ example: 1 }) 
  @Type(() => Number) 
  @IsInt() userId!: number;

  @ApiProperty({ example: 10 }) 
  @Type(() => Number) 
  @IsInt() projectId!: number;
}
