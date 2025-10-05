import { Injectable } from '@nestjs/common';
import { CreatePettyCashDto } from './dto/create-petty-cash.dto';
import { UpdatePettyCashDto } from './dto/update-petty-cash.dto';

@Injectable()
export class PettyCashService {
  create(createPettyCashDto: CreatePettyCashDto) {
    return 'This action adds a new pettyCash';
  }

  findAll() {
    return `This action returns all pettyCash`;
  }

  findOne(id: number) {
    return `This action returns a #${id} pettyCash`;
  }

  update(id: number, updatePettyCashDto: UpdatePettyCashDto) {
    return `This action updates a #${id} pettyCash`;
  }

  remove(id: number) {
    return `This action removes a #${id} pettyCash`;
  }
}
