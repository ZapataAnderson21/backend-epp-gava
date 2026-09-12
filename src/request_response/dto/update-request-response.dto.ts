import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateRequestResponseDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  managementDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  logisticsDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  adminDescription?: string;
}
