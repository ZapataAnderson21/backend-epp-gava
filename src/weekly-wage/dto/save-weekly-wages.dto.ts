import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  Min,
  ValidateNested,
} from 'class-validator';

export class SaveWeeklyWageItemDto {
  @IsInt()
  workerId: number;

  @IsNumber()
  @Min(0)
  afpDiscount: number;

  @IsNumber()
  @Min(0)
  advanceDiscount: number;
}

export class SaveWeeklyWagesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveWeeklyWageItemDto)
  items: SaveWeeklyWageItemDto[];
}
