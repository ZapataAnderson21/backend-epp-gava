import { Injectable } from '@nestjs/common';
import { CreateCategoryResourceDto } from './dto/create-category-resource.dto';
import { UpdateCategoryResourceDto } from './dto/update-category-resource.dto';

@Injectable()
export class CategoryResourceService {
  create(createCategoryResourceDto: CreateCategoryResourceDto) {
    return 'This action adds a new categoryResource';
  }

  findAll() {
    return `This action returns all categoryResource`;
  }

  findOne(id: number) {
    return `This action returns a #${id} categoryResource`;
  }

  update(id: number, updateCategoryResourceDto: UpdateCategoryResourceDto) {
    return `This action updates a #${id} categoryResource`;
  }

  remove(id: number) {
    return `This action removes a #${id} categoryResource`;
  }
}
