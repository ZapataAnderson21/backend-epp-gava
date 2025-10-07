import { Controller, Get, Post, Body, Patch, Param, Delete, Logger, ParseIntPipe } from '@nestjs/common';
import { WorkerGroupService } from './worker-group.service';
import { CreateWorkerGroupDto } from './dto/create-worker-group.dto';
import { UpdateWorkerGroupDto } from './dto/update-worker-group.dto';

@Controller('worker-group')
export class WorkerGroupController {

  private readonly logger = new Logger("WorkerGroupController");

  constructor(private readonly workerGroupService: WorkerGroupService) {}

  @Post()
  create(@Body() createWorkerGroupDto: CreateWorkerGroupDto) {
    this.logger.log(`Creating worker group: ${JSON.stringify(createWorkerGroupDto)}`);
    return this.workerGroupService.create(createWorkerGroupDto);
  }

  @Get()
  findAll() {
    this.logger.log(`Finding all worker groups`);
    return this.workerGroupService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Finding worker group with ID: ${id}`);
    return this.workerGroupService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateWorkerGroupDto: UpdateWorkerGroupDto) {
    this.logger.log(`Updating worker group with ID: ${id}, Data: ${JSON.stringify(updateWorkerGroupDto)}`);
    return this.workerGroupService.update(id, updateWorkerGroupDto);
  }
}
