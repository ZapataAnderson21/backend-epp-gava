import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsEnum,
  IsInt,
  IsPositive,
  ValidateNested,
} from 'class-validator';

export enum GeneralPayrollWorkerGroupDto {
  laborer = 'laborer',
  technician = 'technician',
}

export class GeneralPayrollRosterWorkerDto {
  @ApiProperty({ example: 12 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  workerId!: number;

  @ApiProperty({ enum: GeneralPayrollWorkerGroupDto })
  @IsEnum(GeneralPayrollWorkerGroupDto)
  group!: GeneralPayrollWorkerGroupDto;
}

export class ConfigureGeneralPayrollDto {
  @ApiProperty({
    required: false,
    description: 'Incluir la ubicación Servicios, sin asociarla a un proyecto.',
  })
  @IsOptional()
  @IsBoolean()
  includeServices?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  confirmRemoveServices?: boolean;

  @ApiProperty({ type: [Number], example: [2, 8] })
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @IsPositive({ each: true })
  projectIds!: number[];

  @ApiProperty({ type: [GeneralPayrollRosterWorkerDto] })
  @IsArray()
  @ArrayUnique((worker: GeneralPayrollRosterWorkerDto) => worker.workerId)
  @ValidateNested({ each: true })
  @Type(() => GeneralPayrollRosterWorkerDto)
  workers!: GeneralPayrollRosterWorkerDto[];
}
