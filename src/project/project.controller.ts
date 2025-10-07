import { Controller, Get, Post, Body, Patch, Param, Delete, HttpException, HttpStatus, Put, ParseIntPipe, Logger } from '@nestjs/common';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Public } from 'src/user/jwt/public.decorator';
import { ApiBody, ApiResponse } from '@nestjs/swagger';
import { Project } from './entities/project.entity';
import { UserTypes } from 'src/decorators/user-types.decorator';
import { ProjectStatus } from './enum/project-status.enum';

@Controller('project')
export class ProjectController {

  private readonly logger = new Logger('ProjectController');

  constructor(private readonly projectService: ProjectService) {}

  @UserTypes('GERENTE', 'ADMINISTRADORA')
  @Post()
  async create(@Body() createProjectDto: CreateProjectDto) {
    this.logger.log(`Creating project: ${JSON.stringify(createProjectDto)}`);
    return await this.projectService.create(createProjectDto);
  }

  @Get()
  async findAll() {
    this.logger.log('Fetching all projects');
    return await this.projectService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    this.logger.log(`Fetching project with ID: ${id}`);
    return await this.projectService.findOne(+id);
  }

  @Public()
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
  async update(@Param('id') id: number, @Body() updateProjectDto: UpdateProjectDto) {
    this.logger.log(`Updating project with ID: ${id}`);
    return await this.projectService.update(id, updateProjectDto);
  }

  @Patch(':id/status')
  async updateStatus(@Param('id', ParseIntPipe) id: number, @Body('status') status: ProjectStatus) {
    this.logger.log(`Updating status of project with ID: ${id} to ${status}`);
    return await this.projectService.updateStatus(id, status);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Deleting project with ID: ${id}`);
    return await this.projectService.remove(id);
  }
}
