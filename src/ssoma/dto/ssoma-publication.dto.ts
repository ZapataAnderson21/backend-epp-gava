import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class PublishSsomaDocumentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  idempotencyKey!: string;
}

export class StartSsomaRevisionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  reason!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  topic?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  trainer?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  location?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  targetAudience?: string | null;

  @IsOptional()
  @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
  scheduledTime?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  durationMinutes?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  observations?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  responsibleName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  responsiblePosition?: string | null;
}
