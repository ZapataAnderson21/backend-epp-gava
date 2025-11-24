import { IsArray, IsInt, IsNotEmpty, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UpsertWeekDailyWageItemDto {
  @IsInt()
  @IsNotEmpty()
  workerId!: number;

  @IsNumber()
  @IsNotEmpty()
  amount!: number;
}

export class UpsertWeekDailyWageDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertWeekDailyWageItemDto)
  items!: UpsertWeekDailyWageItemDto[];
}
