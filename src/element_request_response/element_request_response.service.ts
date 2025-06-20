import { Injectable } from '@nestjs/common';
import { CreateElementRequestResponseDto } from './dto/create-element_request_response.dto';
import { UpdateElementRequestResponseDto } from './dto/update-element_request_response.dto';

@Injectable()
export class ElementRequestResponseService {
  create(createElementRequestResponseDto: CreateElementRequestResponseDto) {
    return 'This action adds a new elementRequestResponse';
  }

  findAll() {
    return `This action returns all elementRequestResponse`;
  }

  findOne(id: number) {
    return `This action returns a #${id} elementRequestResponse`;
  }

  update(id: number, updateElementRequestResponseDto: UpdateElementRequestResponseDto) {
    return `This action updates a #${id} elementRequestResponse`;
  }

  remove(id: number) {
    return `This action removes a #${id} elementRequestResponse`;
  }
}
