import { OmitType } from '@nestjs/mapped-types';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { UpdateUserDto } from './update-user.dto';

export class UpdateMeDto extends OmitType(UpdateUserDto, [
  'userTypeId',
] as const) {
  @IsOptional()
  @IsString()
  @MaxLength(72)
  currentPassword?: string;
}
