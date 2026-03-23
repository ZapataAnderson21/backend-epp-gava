import { PartialType } from '@nestjs/mapped-types';
import { CreateElementRequestDto } from './create-element_request.dto';

export class UpdateElementRequestDto extends PartialType(
  CreateElementRequestDto,
) {}
