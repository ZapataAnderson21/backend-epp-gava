import { PartialType } from '@nestjs/swagger';
import { CreateWorkerGroupDto } from './create-worker-group.dto';

export class UpdateWorkerGroupDto extends PartialType(CreateWorkerGroupDto) {}
