import { PartialType } from '@nestjs/swagger';
import { CreateExpiringDocumentDto } from './create-expiring-document.dto';

export class UpdateExpiringDocumentDto extends PartialType(
  CreateExpiringDocumentDto,
) {}
