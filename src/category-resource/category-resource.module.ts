import { Module } from '@nestjs/common';
import { CategoryResourceService } from './category-resource.service';
import { CategoryResourceController } from './category-resource.controller';

@Module({
  controllers: [CategoryResourceController],
  providers: [CategoryResourceService],
})
export class CategoryResourceModule {}
