import { Injectable } from '@nestjs/common';
import { CreateRequestResponseDto } from './dto/create-request_response.dto';
import { UpdateRequestResponseDto } from './dto/update-request_response.dto';

@Injectable()
export class RequestResponseService {
  create(createRequestResponseDto: CreateRequestResponseDto) {
    return 'This action adds a new requestResponse';
  }

  findAll() {
    return `This action returns all requestResponse`;
  }

  findOne(id: number) {
    return `This action returns a #${id} requestResponse`;
  }

  update(id: number, updateRequestResponseDto: UpdateRequestResponseDto) {
    return `This action updates a #${id} requestResponse`;
  }

  remove(id: number) {
    return `This action removes a #${id} requestResponse`;
  }
}
