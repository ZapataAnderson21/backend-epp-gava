import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsNumber } from 'class-validator';

export enum GeneralPayrollAttendanceFieldDto {
  monday = 'monday',
  tuesday = 'tuesday',
  wednesday = 'wednesday',
  thursday = 'thursday',
  friday = 'friday',
  saturday = 'saturday',
  dominical = 'dominical',
}

export class UpdateGeneralPayrollAttendanceDto {
  @ApiProperty({ enum: GeneralPayrollAttendanceFieldDto })
  @IsEnum(GeneralPayrollAttendanceFieldDto)
  field!: GeneralPayrollAttendanceFieldDto;

  @ApiProperty({ enum: [0, 1] })
  @Type(() => Number)
  @IsNumber()
  @IsIn([0, 1], { message: 'La asistencia debe ser 0 o 1.' })
  value!: number;
}
