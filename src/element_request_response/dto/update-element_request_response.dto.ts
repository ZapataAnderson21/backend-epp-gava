import { PartialType } from '@nestjs/mapped-types';
import { CreateElementRequestResponseDto } from './create-element_request_response.dto';

export class UpdateElementRequestResponseDto extends PartialType(
  CreateElementRequestResponseDto,
) {}
