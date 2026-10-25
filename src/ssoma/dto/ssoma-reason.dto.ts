import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class SsomaReasonDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  @Matches(/\S/)
  reason!: string;
}
