import { Injectable } from '@nestjs/common';
import { CreateElementDto } from './dto/create-element.dto';
import { UpdateElementDto } from './dto/update-element.dto';

@Injectable()
export class ElementService {
  create(createElementDto: CreateElementDto) {
    return 'This action adds a new element';
  }

  findAll() {
    return `This action returns all element`;
  }

  findOne(id: number) {
    return `This action returns a #${id} element`;
  }

  update(id: number, updateElementDto: UpdateElementDto) {
    return `This action updates a #${id} element`;
  }

  remove(id: number) {
    return `This action removes a #${id} element`;
  }
}
