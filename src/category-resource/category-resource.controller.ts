import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Logger,
} from '@nestjs/common';
import { CategoryResourceService } from './category-resource.service';
import { CreateCategoryResourceDto } from './dto/create-category-resource.dto';
import { UpdateCategoryResourceDto } from './dto/update-category-resource.dto';

@Controller('category-resource')
export class CategoryResourceController {
  private readonly logger = new Logger('CategoryResourceController');

  constructor(
    private readonly categoryResourceService: CategoryResourceService,
  ) {}

  @Post()
  create(@Body() createCategoryResourceDto: CreateCategoryResourceDto) {
    this.logger.log(
      `Creating categoryResource: ${JSON.stringify(createCategoryResourceDto)}`,
    );
    return this.categoryResourceService.create(createCategoryResourceDto);
  }

  @Get()
  findAll() {
    this.logger.log(`Finding all categoryResources`);
    return this.categoryResourceService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    this.logger.log(`Finding categoryResource with ID: ${id}`);
    return this.categoryResourceService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateCategoryResourceDto: UpdateCategoryResourceDto,
  ) {
    this.logger.log(`Updating categoryResource with ID: ${id}`);
    return this.categoryResourceService.update(+id, updateCategoryResourceDto);
  }
}
