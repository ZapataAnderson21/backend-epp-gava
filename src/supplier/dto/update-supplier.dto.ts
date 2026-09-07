import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches, ValidateIf } from 'class-validator';
import { CreateSupplierDto } from './create-supplier.dto';

export class UpdateSupplierDto extends PartialType(
  OmitType(CreateSupplierDto, ['abbreviation'] as const),
) {
  // PATCH may omit the field, but explicit null must not bypass validation.
  @ApiPropertyOptional({
    example: 'DIPACO',
    minLength: 1,
    maxLength: 8,
    nullable: false,
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[A-Z0-9]{1,8}$/, {
    message:
      'La abreviatura debe contener de 1 a 8 letras mayúsculas o números, sin espacios ni símbolos.',
  })
  abbreviation?: string;
}
