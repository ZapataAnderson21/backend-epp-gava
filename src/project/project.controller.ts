import { Controller, Get, Post, Body, Patch, Param, Delete, HttpException, HttpStatus, Put } from '@nestjs/common';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Public } from 'src/user/jwt/public.decorator';
import { ApiBody, ApiResponse } from '@nestjs/swagger';
import { Project } from './entities/project.entity';

@Controller('project')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Public()
  @ApiBody({ type: CreateProjectDto })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Project created successfully', type: Project })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Project creation failed' })
  @Post()
  async create(@Body() createProjectDto: CreateProjectDto) {
    try {

      const { name, code, description } = createProjectDto;

      const existingProject = await this.projectService.findByCode(code);

      if (existingProject) {
        throw new HttpException('Project with this code already exists', HttpStatus.BAD_REQUEST);
      }

      const project = await this.projectService.create(createProjectDto);

      if (!project) {
        throw new HttpException('Project creation failed', 500);
      }

      return {
        statusCode: HttpStatus.CREATED,
        message: 'Project created successfully',
        data: project,
      };

    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Project creation failed',
        error: error.message || 'Internal Server Error',
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }


  @Public()
  @ApiResponse({ status: HttpStatus.OK, description: 'Projects retrieved successfully', type: [Project] })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No projects found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Failed to retrieve projects' })
  @Get()
  async findAll() {
    try {
      const projects = await this.projectService.findAll();

      if (!projects || projects.length === 0) {
        return {
          statusCode: HttpStatus.OK,
          message: 'No projects found',
          data: [],
        };
      }

      return {
        statusCode: HttpStatus.OK,
        message: 'Projects retrieved successfully',
        data: projects,
      };
    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to retrieve projects',
        error: error.message || 'Internal Server Error',
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Public()
  @ApiResponse({ status: HttpStatus.OK, description: 'Project retrieved successfully', type: Project })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Project not found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Failed to retrieve project' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const project = await this.projectService.findOne(+id);

      if (!project) {
        return {
          statusCode: HttpStatus.OK,
          message: 'Project not found',
          data: null,
        };
      }

      return {
        statusCode: HttpStatus.OK,
        message: 'Project retrieved successfully',
        data: project,
      };
    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to retrieve project',
        error: error.message || 'Internal Server Error',
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Public()
  @ApiBody({ schema: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] } })
  @ApiResponse({ status: HttpStatus.OK, description: 'Project retrieved successfully', type: Project })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Project not found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Failed to retrieve project' })
  @Get('code/:code')
  async findByCode(@Param('code') code: string) {
    try {
      const project = await this.projectService.findByCode(code);

      if (!project) {
        return {
          statusCode: HttpStatus.OK,
          message: 'Project not found',
          data: null,
        };
      }

      return {
        statusCode: HttpStatus.OK,
        message: 'Project retrieved successfully',
        data: project,
      };
    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to retrieve project',
        error: error.message || 'Internal Server Error',
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Public()
  @ApiBody({ schema: { type: 'object', properties: { status: { type: 'string' } }, required: ['status'] } })
  @ApiResponse({ status: HttpStatus.OK, description: 'Projects retrieved successfully', type: [Project] })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No projects found with the given status' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Failed to retrieve projects' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid status parameter' })
  @Get('status/:status')
  async findByStatus(@Param('status') status: string) {
    try {

      if(!status) {
        throw new HttpException('Status parameter is required', HttpStatus.BAD_REQUEST);
      }

      if (status !== 'active' && status !== 'inactive') {
        throw new HttpException('Status must be either "active" or "inactive"', HttpStatus.BAD_REQUEST);
      }

      const projects = await this.projectService.findByStatus(status);

      if (!projects || projects.length === 0) {
        return {
          statusCode: HttpStatus.OK,
          message: 'No projects found with the given status',
          data: [],
        };
      }

      return {
        statusCode: HttpStatus.OK,
        message: 'Projects retrieved successfully',
        data: projects,
      };
    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to retrieve projects',
        error: error.message || 'Internal Server Error',
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Public()
  @ApiBody({ type: UpdateProjectDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Project updated successfully', type: Project })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Project not found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Failed to update project' })
  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateProjectDto: UpdateProjectDto) {
    try {
      const project = await this.projectService.update(+id, updateProjectDto);

      if (!project) {
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Project not found',
          data: null,
        };
      }

      return {
        statusCode: HttpStatus.OK,
        message: 'Project updated successfully',
        data: project,
      };
    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to update project',
        error: error.message || 'Internal Server Error',
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Public()
  @ApiBody({ schema: { type: 'object', properties: { status: { type: 'string' } }, required: ['status'] } })
  @ApiResponse({ status: HttpStatus.OK, description: 'Project status updated successfully', type: Project })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Project not found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Failed to update project status' })
  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body('status') status: string) {
    try {
      const project = await this.projectService.updateStatus(+id, status);

      if (!project) {
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Project not found',
          data: null,
        };
      }

      return {
        statusCode: HttpStatus.OK,
        message: 'Project status updated successfully',
        data: project,
      };
    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to update project status',
        error: error.message || 'Internal Server Error',
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
