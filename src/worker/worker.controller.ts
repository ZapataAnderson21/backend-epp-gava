import { Controller, Get, Post, Body, Patch, Param, Delete, Logger, ParseIntPipe } from '@nestjs/common';
import { WorkerService } from './worker.service';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';

@Controller('worker')
export class WorkerController {

  private readonly logger = new Logger("WorkerController");

  constructor(private readonly workerService: WorkerService) {}

  @Post()
  create(@Body() createWorkerDto: CreateWorkerDto) {
    this.logger.log(`Creating worker: ${JSON.stringify(createWorkerDto)}`);
    return this.workerService.create(createWorkerDto);
  }

  @Get()
  findAll() {
    this.logger.log(`Finding all workers`);
    return this.workerService.findAll();
  }

  @Get('group/:workerGroupId')
  findAllByWorkerGroupId(@Param('workerGroupId', ParseIntPipe) workerGroupId: number) {
    this.logger.log(`Finding workers with Group ID: ${workerGroupId}`);
    return this.workerService.findAllByWorkerGroupId(workerGroupId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Finding worker with ID: ${id}`);
    return this.workerService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateWorkerDto: UpdateWorkerDto) {
    this.logger.log(`Updating worker with ID: ${id}, Data: ${JSON.stringify(updateWorkerDto)}`);
    return this.workerService.update(id, updateWorkerDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Removing worker with ID: ${id}`);
    return this.workerService.remove(id);
  }
}
