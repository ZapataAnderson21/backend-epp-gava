import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class CaptureSignatureDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  workerId!: number;
}
