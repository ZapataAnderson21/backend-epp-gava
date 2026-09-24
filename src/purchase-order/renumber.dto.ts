import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
export class PreviewRenumberDto {
  @IsInt() @Min(2000) @Max(9999) year!: number;
  @IsInt() @Min(1) @Max(999999899) start!: number;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  ids!: number[];
}
export class ApplyRenumberDto {
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}
