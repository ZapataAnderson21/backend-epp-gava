import { Type } from 'class-transformer';
import { IsArray, IsInt, ValidateNested } from 'class-validator';

export class SaveWeeklyWageItemDto {
  @IsInt()
  workerId: number;
}

export class SaveWeeklyWagesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveWeeklyWageItemDto)
  items: SaveWeeklyWageItemDto[];
}
