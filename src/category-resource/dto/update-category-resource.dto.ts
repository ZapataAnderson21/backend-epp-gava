import { PartialType } from '@nestjs/swagger';
import { CreateCategoryResourceDto } from './create-category-resource.dto';

export class UpdateCategoryResourceDto extends PartialType(CreateCategoryResourceDto) {}
