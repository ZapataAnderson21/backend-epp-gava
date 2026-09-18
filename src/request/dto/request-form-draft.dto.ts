import {
  IsInt,
  IsObject,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
export class RequestDraftSlotDto {
  @Matches(/^(new|project-[1-9]\d{0,9}|[1-9]\d{0,9})$/)
  slot!: string;
}
export class SaveRequestFormDraftDto {
  @IsInt()
  @Min(0)
  @Max(2147483646)
  expectedVersion!: number;

  @ValidateIf((_object, value: unknown) => value !== null)
  @IsObject()
  payload!: Record<string, unknown> | null;
}
