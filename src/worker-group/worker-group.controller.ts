import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { WorkerGroupService } from './worker-group.service';
import { CreateWorkerGroupDto } from './dto/create-worker-group.dto';
import { UpdateWorkerGroupDto } from './dto/update-worker-group.dto';

@Controller('worker-group')
export class WorkerGroupController {
  constructor(private readonly workerGroupService: WorkerGroupService) {}

  @Post()
  create(@Body() createWorkerGroupDto: CreateWorkerGroupDto) {
    return this.workerGroupService.create(createWorkerGroupDto);
  }

  @Get()
  findAll() {
    return this.workerGroupService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.workerGroupService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateWorkerGroupDto: UpdateWorkerGroupDto) {
    return this.workerGroupService.update(+id, updateWorkerGroupDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.workerGroupService.remove(+id);
  }
}
