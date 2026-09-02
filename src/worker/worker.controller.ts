import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Logger,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { WorkerService } from './worker.service';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { WorkerType } from './enum/worker-type.enum';
import { ListWorkersQueryDto } from './dto/list-workers-query.dto';
import { UserTypes } from '../decorators/user-types.decorator';

@Controller('worker')
export class WorkerController {
  private readonly logger = new Logger('WorkerController');

  constructor(private readonly workerService: WorkerService) {}

  @Post()
  @UserTypes('GERENTE', 'ADMINISTRADOR', 'ADMINISTRADORA', 'LOGISTICA')
  create(@Body() createWorkerDto: CreateWorkerDto) {
    this.logger.log(`Creating worker: ${JSON.stringify(createWorkerDto)}`);
    return this.workerService.create(createWorkerDto);
  }

  @Get()
  findAll() {
    this.logger.log(`Finding all workers`);
    return this.workerService.findAll();
  }

  @Get('paginated')
  findPaginated(@Query() query: ListWorkersQueryDto) {
    return this.workerService.findPaginated(query);
  }

  @Get('type/:workerType')
  findAllByWorkerType(@Param('workerType') workerType: WorkerType) {
    this.logger.log(`Finding workers with Type: ${workerType}`);
    return this.workerService.findAllByWorkerType(workerType);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Finding worker with ID: ${id}`);
    return this.workerService.findOne(id);
  }

  @Patch(':id')
  @UserTypes('GERENTE', 'ADMINISTRADOR', 'ADMINISTRADORA', 'LOGISTICA')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateWorkerDto: UpdateWorkerDto,
  ) {
    this.logger.log(
      `Updating worker with ID: ${id}, Data: ${JSON.stringify(updateWorkerDto)}`,
    );
    return this.workerService.update(id, updateWorkerDto);
  }

  @Delete(':id')
  @UserTypes('GERENTE', 'ADMINISTRADOR', 'ADMINISTRADORA', 'LOGISTICA')
  remove(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Removing worker with ID: ${id}`);
    return this.workerService.remove(id);
  }
}
