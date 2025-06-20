import { Injectable } from '@nestjs/common';
import { CreateElementRequestDto } from './dto/create-element_request.dto';
import { UpdateElementRequestDto } from './dto/update-element_request.dto';

@Injectable()
export class ElementRequestService {
  create(createElementRequestDto: CreateElementRequestDto) {
    return 'This action adds a new elementRequest';
  }

  findAll() {
    return `This action returns all elementRequest`;
  }

  findOne(id: number) {
    return `This action returns a #${id} elementRequest`;
  }

  update(id: number, updateElementRequestDto: UpdateElementRequestDto) {
    return `This action updates a #${id} elementRequest`;
  }

  remove(id: number) {
    return `This action removes a #${id} elementRequest`;
  }
}
