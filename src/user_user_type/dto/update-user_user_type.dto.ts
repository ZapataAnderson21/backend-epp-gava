import { PartialType } from '@nestjs/mapped-types';
import { CreateUserUserTypeDto } from './create-user_user_type.dto';

export class UpdateUserUserTypeDto extends PartialType(CreateUserUserTypeDto) {}
