import { PartialType } from '@nestjs/mapped-types';
import { CreateRequestResponseDto } from './create-request_response.dto';

export class UpdateRequestResponseDto extends PartialType(CreateRequestResponseDto) {}
