import { Controller, Get, Post, Body, Patch, Param, Delete, Logger, ParseIntPipe } from '@nestjs/common';
import { ResourceService } from './resource.service';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';

@Controller('resource')
export class ResourceController {

  private readonly logger = new Logger('ResourceController');

  constructor(private readonly resourceService: ResourceService) {}

  @Post()
  create(@Body() createResourceDto: CreateResourceDto) {
    this.logger.log(`Creating resource: ${JSON.stringify(createResourceDto)}`);
    return this.resourceService.create(createResourceDto);
  }

  @Get()
  findAll() {
    this.logger.log(`Finding all resources`);
    return this.resourceService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    this.logger.log(`Finding resource with ID: ${id}`);
    return this.resourceService.findOne(+id);
  }

  @Get('category/:id')
  findByCategoryResourceId(@Param('id', ParseIntPipe) categoryResourceId: number) {
    this.logger.log(`Finding resources for categoryResourceId: ${categoryResourceId}`);
    return this.resourceService.findByCategoryResourceId(categoryResourceId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateResourceDto: UpdateResourceDto) {
    this.logger.log(`Updating resource with ID: ${id}`);
    return this.resourceService.update(+id, updateResourceDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    this.logger.log(`Removing resource with ID: ${id}`);
    return this.resourceService.remove(+id);
  }
}
