import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Logger,
  Delete,
} from '@nestjs/common';
import { ElementService } from './element.service';
import { CreateElementDto } from './dto/create-element.dto';
import { UpdateElementDto } from './dto/update-element.dto';
import { ElementType } from './enum/element-type.enum';

@Controller('element')
export class ElementController {
  private readonly logger = new Logger('ElementController');

  constructor(private readonly elementService: ElementService) {}

  @Post()
  async create(@Body() createElementDto: CreateElementDto) {
    this.logger.log(`Creating element: ${JSON.stringify(createElementDto)}`);
    return await this.elementService.create(createElementDto);
  }

  @Get()
  async findAll() {
    this.logger.log('Fetching all elements');
    return await this.elementService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: number) {
    this.logger.log(`Fetching element with ID: ${id}`);
    return await this.elementService.findOne(id);
  }

  @Get('type/:type')
  async findAllByType(@Param('type') type: ElementType) {
    this.logger.log(`Fetching elements with type: ${type}`);
    return await this.elementService.findAllByType(type);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateElementDto: UpdateElementDto,
  ) {
    this.logger.log(`Updating element with ID: ${id}`);
    return await this.elementService.update(+id, updateElementDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    this.logger.log(`Deleting element with ID: ${id}`);
    return await this.elementService.remove(+id);
  }
}
