import {
  IsInt,
  IsNumberString,
  IsObject,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class DraftSlotDto {
  @IsNumberString()
  projectId!: string;

  @Matches(/^(new|[1-9]\d{0,9})$/)
  slot!: string;
}

export class SavePurchaseOrderDraftDto {
  @IsInt()
  @Min(0)
  @Max(2147483646)
  expectedVersion!: number;

  // Null clears a draft; undefined, arrays and scalar values are rejected.
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsObject()
  payload!: Record<string, unknown> | null;
}
