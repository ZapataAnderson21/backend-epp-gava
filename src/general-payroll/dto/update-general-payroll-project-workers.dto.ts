import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsPositive,
} from 'class-validator';

export class UpdateGeneralPayrollProjectWorkersDto {
  @ApiProperty({
    type: [Number],
    description:
      'Identificadores de los trabajadores de la plantilla asignados al proyecto.',
  })
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @IsPositive({ each: true })
  generalPayrollWorkerIds!: number[];

  @ApiPropertyOptional({
    default: false,
    description:
      'Confirma el borrado de asistencias y montos de trabajadores retirados.',
  })
  @IsOptional()
  @IsBoolean()
  confirmClearAttendance?: boolean;
}
