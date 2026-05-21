import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Logger,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { ElementService } from './element.service';
import { CreateElementDto } from './dto/create-element.dto';
import { UpdateElementDto } from './dto/update-element.dto';
import { CreateFallProtectionGroupDto } from './dto/create-fall-protection-group.dto';
import { ElementFamily, ElementType } from './enum/element-type.enum';
import { UserTypes } from 'src/decorators/user-types.decorator';

const INVENTORY_ITEM_MANAGER_ROLES = [
  'GERENTE',
  'ADMINISTRADORA',
  'LOGISTICA',
  'PREVENCIONISTA DE RIESGOS',
] as const;

@Controller('element')
export class ElementController {
  private readonly logger = new Logger('ElementController');

  constructor(private readonly elementService: ElementService) {}

  @Post()
  @UserTypes(...INVENTORY_ITEM_MANAGER_ROLES)
  async create(@Body() createElementDto: CreateElementDto) {
    this.logger.log(`Creating element: ${JSON.stringify(createElementDto)}`);
    return await this.elementService.create(createElementDto);
  }

  @Get()
  async findAll() {
    this.logger.log('Fetching all elements');
    return await this.elementService.findAll();
  }

  @Get('type/:type')
  async findAllByType(@Param('type') type: ElementType) {
    this.logger.log(`Fetching elements with type: ${type}`);
    return await this.elementService.findAllByType(type);
  }

  @Get('family/:family')
  async findAllByFamily(@Param('family') family: ElementFamily) {
    this.logger.log(`Fetching elements with family: ${family}`);
    return await this.elementService.findAllByFamily(family);
  }

  @Get('legacy')
  async findAllLegacy() {
    this.logger.log('Fetching legacy elements');
    return await this.elementService.findAllLegacy();
  }

  @Post('fall-protection-groups')
  @UserTypes(...INVENTORY_ITEM_MANAGER_ROLES)
  async createFallProtectionGroup(
    @Body() createFallProtectionGroupDto: CreateFallProtectionGroupDto,
  ) {
    this.logger.log(
      `Creating fall protection group: ${JSON.stringify(createFallProtectionGroupDto)}`,
    );
    return await this.elementService.createFallProtectionGroup(
      createFallProtectionGroupDto,
    );
  }

  @Get('fall-protection-groups')
  async findFallProtectionGroups() {
    this.logger.log('Fetching fall protection groups');
    return await this.elementService.findFallProtectionGroups();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Fetching element with ID: ${id}`);
    return await this.elementService.findOne(id);
  }

  @Patch(':id')
  @UserTypes(...INVENTORY_ITEM_MANAGER_ROLES)
  async update(
    @Param('id') id: string,
    @Body() updateElementDto: UpdateElementDto,
  ) {
    this.logger.log(`Updating element with ID: ${id}`);
    return await this.elementService.update(+id, updateElementDto);
  }

  @Delete(':id')
  @UserTypes(...INVENTORY_ITEM_MANAGER_ROLES)
  async remove(@Param('id') id: string) {
    this.logger.log(`Deleting element with ID: ${id}`);
    return await this.elementService.remove(+id);
  }
}
