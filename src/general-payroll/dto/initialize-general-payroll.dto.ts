import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class InitializeGeneralPayrollDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  copyPreviousWorkers?: boolean;
}
