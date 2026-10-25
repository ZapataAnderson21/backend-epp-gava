import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class RunSsomaRetentionDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  batchSize?: number;
}

export class SetSsomaRetentionHoldDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  reason!: string;

  @IsOptional()
  @IsDateString()
  holdUntil?: string;
}

export class ClearSsomaRetentionHoldDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  reason!: string;
}
