import { Controller, Get, Post, Body, Patch, Param, Delete, HttpException, HttpStatus, Put, ParseIntPipe } from '@nestjs/common';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Public } from 'src/user/jwt/public.decorator';
import { ApiBody, ApiResponse } from '@nestjs/swagger';
import { Project } from './entities/project.entity';
import { UserTypes } from 'src/decorators/user-types.decorator';

@Controller('project')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @UserTypes('GERENTE', 'ADMINISTRADORA')
  @ApiBody({ type: CreateProjectDto })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Project created successfully', type: Project })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Project creation failed' })
  @Post()
  async create(@Body() createProjectDto: CreateProjectDto) {
      return await this.projectService.create(createProjectDto);
  }


  @ApiResponse({ status: HttpStatus.OK, description: 'Projects retrieved successfully', type: [Project] })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No projects found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Failed to retrieve projects' })
  @Get()
  async findAll() {
    return await this.projectService.findAll();
  }

  @ApiResponse({ status: HttpStatus.OK, description: 'Project retrieved successfully', type: Project })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Project not found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Failed to retrieve project' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.projectService.findOne(+id);
  }

  @Public()
  @ApiResponse({ status: HttpStatus.OK, description: 'Project retrieved successfully', type: Project })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Project not found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Failed to retrieve project' })
  @Get('code/:code')
  async findByCode(@Param('code') code: string) {
    return await this.projectService.findByCode(code);
  }

  @ApiBody({ schema: { type: 'object', properties: { status: { type: 'string' } }, required: ['status'] } })
  @ApiResponse({ status: HttpStatus.OK, description: 'Projects retrieved successfully', type: [Project] })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No projects found with the given status' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Failed to retrieve projects' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid status parameter' })
  @Get('status/:status')
  async findByStatus(@Param('status') status: string) {
    return await this.projectService.findByStatus(status);
  }

  @ApiBody({ type: UpdateProjectDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Project updated successfully', type: Project })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Project not found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Failed to update project' })
  @Patch(':id')
  async update(@Param('id') id: number, @Body() updateProjectDto: UpdateProjectDto) {
    return await this.projectService.update(id, updateProjectDto);
  }

  @ApiBody({ schema: { type: 'object', properties: { status: { type: 'string' } }, required: ['status'] } })
  @ApiResponse({ status: HttpStatus.OK, description: 'Project status updated successfully', type: Project })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Project not found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Failed to update project status' })
  @Patch(':id/status')
  async updateStatus(@Param('id', ParseIntPipe) id: number, @Body('status') status: string) {
    return await this.projectService.updateStatus(id, status);
  }
}
