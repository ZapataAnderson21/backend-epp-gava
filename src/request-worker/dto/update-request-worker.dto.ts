import { PartialType } from '@nestjs/swagger';
import { CreateRequestWorkerDto } from './create-request-worker.dto';

export class UpdateRequestWorkerDto extends PartialType(CreateRequestWorkerDto) {}
