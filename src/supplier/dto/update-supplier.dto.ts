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
    maxLength: 10,
    nullable: false,
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[!-\x2E\x30-\x60\x7B-\x7E]{1,10}$/, {
    message:
      'La abreviatura debe contener de 1 a 10 caracteres: letras A-Z, números o símbolos ASCII, sin espacios ni /.',
  })
  abbreviation?: string;
}
