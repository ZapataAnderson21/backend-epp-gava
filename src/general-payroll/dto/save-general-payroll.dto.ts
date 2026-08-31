import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsIn,
  IsNumber,
  IsPositive,
  Min,
  ValidateNested,
} from 'class-validator';

const moneyOptions = { maxDecimalPlaces: 2 } as const;

export class SaveGeneralPayrollWorkerDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  generalPayrollWorkerId!: number;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber(moneyOptions)
  @Min(0)
  dailyWage!: number;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber(moneyOptions)
  @Min(0)
  additionalAmount!: number;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber(moneyOptions)
  @Min(0)
  liquidationAmount!: number;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber(moneyOptions)
  @Min(0)
  sundayDinnerAmount!: number;
}

export class SaveGeneralPayrollEntryDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  generalPayrollEntryId!: number;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber(moneyOptions)
  @IsIn([0, 1], { message: 'La asistencia del lunes debe ser 0 o 1.' })
  monday!: number;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber(moneyOptions)
  @IsIn([0, 1], { message: 'La asistencia del martes debe ser 0 o 1.' })
  tuesday!: number;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber(moneyOptions)
  @IsIn([0, 1], { message: 'La asistencia del miércoles debe ser 0 o 1.' })
  wednesday!: number;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber(moneyOptions)
  @IsIn([0, 1], { message: 'La asistencia del jueves debe ser 0 o 1.' })
  thursday!: number;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber(moneyOptions)
  @IsIn([0, 1], { message: 'La asistencia del viernes debe ser 0 o 1.' })
  friday!: number;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber(moneyOptions)
  @IsIn([0, 1], { message: 'La asistencia del sábado debe ser 0 o 1.' })
  saturday!: number;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber(moneyOptions)
  @IsIn([0, 1], { message: 'La asistencia dominical debe ser 0 o 1.' })
  dominical!: number;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber(moneyOptions)
  @Min(0)
  overtimeAmount!: number;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber(moneyOptions)
  @Min(0)
  afpDiscount!: number;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber(moneyOptions)
  @Min(0)
  advanceDiscount!: number;
}

export class SaveGeneralPayrollDto {
  @ApiProperty({ type: [SaveGeneralPayrollWorkerDto] })
  @IsArray()
  @ArrayUnique(
    (worker: SaveGeneralPayrollWorkerDto) => worker.generalPayrollWorkerId,
  )
  @ValidateNested({ each: true })
  @Type(() => SaveGeneralPayrollWorkerDto)
  workers!: SaveGeneralPayrollWorkerDto[];

  @ApiProperty({ type: [SaveGeneralPayrollEntryDto] })
  @IsArray()
  @ArrayUnique(
    (entry: SaveGeneralPayrollEntryDto) => entry.generalPayrollEntryId,
  )
  @ValidateNested({ each: true })
  @Type(() => SaveGeneralPayrollEntryDto)
  entries!: SaveGeneralPayrollEntryDto[];
}
