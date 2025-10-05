import { Injectable } from '@nestjs/common';
import { CreateWorkerGroupDto } from './dto/create-worker-group.dto';
import { UpdateWorkerGroupDto } from './dto/update-worker-group.dto';

@Injectable()
export class WorkerGroupService {
  create(createWorkerGroupDto: CreateWorkerGroupDto) {
    return 'This action adds a new workerGroup';
  }

  findAll() {
    return `This action returns all workerGroup`;
  }

  findOne(id: number) {
    return `This action returns a #${id} workerGroup`;
  }

  update(id: number, updateWorkerGroupDto: UpdateWorkerGroupDto) {
    return `This action updates a #${id} workerGroup`;
  }

  remove(id: number) {
    return `This action removes a #${id} workerGroup`;
  }
}
