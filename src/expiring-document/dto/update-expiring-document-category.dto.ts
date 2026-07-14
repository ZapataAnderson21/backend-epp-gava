import { PartialType } from '@nestjs/swagger';
import { CreateExpiringDocumentCategoryDto } from './create-expiring-document-category.dto';

export class UpdateExpiringDocumentCategoryDto extends PartialType(
  CreateExpiringDocumentCategoryDto,
) {}
