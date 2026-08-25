import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Logger,
  Query,
} from '@nestjs/common';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UserTypes } from 'src/decorators/user-types.decorator';
import { ProjectStatus } from './enum/project-status.enum';
import { ListProjectsQueryDto } from './dto/list-projects-query.dto';

@Controller('project')
export class ProjectController {
  private readonly logger = new Logger('ProjectController');

  constructor(private readonly projectService: ProjectService) {}

  @Post()
  @UserTypes('GERENTE', 'ADMINISTRADORA')
  async create(@Body() createProjectDto: CreateProjectDto) {
    this.logger.log(`Creating project: ${JSON.stringify(createProjectDto)}`);
    return await this.projectService.create(createProjectDto);
  }

  @Get()
  async findAll() {
    this.logger.log('Fetching all projects');
    return await this.projectService.findAll();
  }

  @Get('paginated')
  async findPaginated(@Query() query: ListProjectsQueryDto) {
    return await this.projectService.findPaginated(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    this.logger.log(`Fetching project with ID: ${id}`);
    return await this.projectService.findOne(+id);
  }

  @Get('code/:code')
  async findByCode(@Param('code') code: string) {
    this.logger.log(`Fetching project with code: ${code}`);
    return await this.projectService.findByCode(code);
  }

  @Get('status/:status')
  async findByStatus(@Param('status') status: ProjectStatus) {
    this.logger.log(`Fetching projects with status: ${status}`);
    return await this.projectService.findByStatus(status);
  }

  @Patch(':id')
  @UserTypes('GERENTE', 'ADMINISTRADORA')
  async update(
    @Param('id') id: number,
    @Body() updateProjectDto: UpdateProjectDto,
  ) {
    this.logger.log(`Updating project with ID: ${id}`);
    return await this.projectService.update(id, updateProjectDto);
  }

  @Patch(':id/status')
  @UserTypes('GERENTE', 'ADMINISTRADORA')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: ProjectStatus,
  ) {
    this.logger.log(`Updating status of project with ID: ${id} to ${status}`);
    return await this.projectService.updateStatus(id, status);
  }

  @Delete(':id')
  @UserTypes('GERENTE', 'ADMINISTRADORA')
  async remove(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Deleting project with ID: ${id}`);
    return await this.projectService.remove(id);
  }
}
