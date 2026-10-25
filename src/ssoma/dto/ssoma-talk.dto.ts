import { OmitType, PartialType } from '@nestjs/mapped-types';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { SsomaTalkStatus } from 'src/generated/prisma';
import { SsomaPaginationDto } from './ssoma-pagination.dto';

const dateOnlyOptions = { strict: true };

export class CreateSsomaTalkDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  projectId!: number;

  @IsDateString(dateOnlyOptions)
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  talkDate!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  topic!: string;

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

class EditableSsomaTalkDto extends OmitType(CreateSsomaTalkDto, [
  'projectId',
] as const) {}

export class UpdateSsomaTalkDto extends PartialType(EditableSsomaTalkDto) {}

export class ListSsomaTalksQueryDto extends SsomaPaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  projectId?: number;

  @IsOptional()
  @IsEnum(SsomaTalkStatus)
  status?: SsomaTalkStatus;

  @IsOptional()
  @IsDateString(dateOnlyOptions)
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateFrom?: string;

  @IsOptional()
  @IsDateString(dateOnlyOptions)
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

export class SearchSsomaWorkersQueryDto extends SsomaPaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class SsomaAvailabilityQueryDto {
  @IsDateString(dateOnlyOptions)
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map(Number)
      : typeof value === 'string'
        ? value.split(',').map(Number)
        : value,
  )
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsInt({ each: true })
  @Min(1, { each: true })
  workerIds!: number[];
}

export class SsomaAuditQueryDto extends SsomaPaginationDto {}

export class AddSsomaParticipantsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  workerIds!: number[];
}
