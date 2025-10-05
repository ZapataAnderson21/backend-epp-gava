import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CategoryResourceService } from './category-resource.service';
import { CreateCategoryResourceDto } from './dto/create-category-resource.dto';
import { UpdateCategoryResourceDto } from './dto/update-category-resource.dto';

@Controller('category-resource')
export class CategoryResourceController {
  constructor(private readonly categoryResourceService: CategoryResourceService) {}

  @Post()
  create(@Body() createCategoryResourceDto: CreateCategoryResourceDto) {
    return this.categoryResourceService.create(createCategoryResourceDto);
  }

  @Get()
  findAll() {
    return this.categoryResourceService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.categoryResourceService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCategoryResourceDto: UpdateCategoryResourceDto) {
    return this.categoryResourceService.update(+id, updateCategoryResourceDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.categoryResourceService.remove(+id);
  }
}
