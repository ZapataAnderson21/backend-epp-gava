import { PartialType } from '@nestjs/mapped-types';
import { CreateUserTypeDto } from './create-user_type.dto';

export class UpdateUserTypeDto extends PartialType(CreateUserTypeDto) {}
